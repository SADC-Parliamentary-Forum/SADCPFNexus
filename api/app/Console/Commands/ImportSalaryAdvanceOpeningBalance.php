<?php

namespace App\Console\Commands;

use App\Models\BalanceRegister;
use App\Models\SalaryAdvanceRequest;
use App\Models\User;
use App\Modules\Finance\Services\BalanceRegisterService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Light historical / opening-balance import for Salary Advances.
 *
 * Creates a closed (or outstanding) historical advance with a BCRE register.
 * Not a full data-migration suite — for one-off ops imports only.
 */
class ImportSalaryAdvanceOpeningBalance extends Command
{
    protected $signature = 'salary-advance:import-opening-balance
        {employee_email : Employee email}
        {amount : Principal amount}
        {--reference= : Optional reference number}
        {--paid-at= : Payment date (Y-m-d)}
        {--recovered : Mark fully recovered and closed with zero balance}
        {--currency=NAD : Currency code}
        {--purpose=Historical opening balance : Purpose text}';

    protected $description = 'Import a historical salary advance opening balance (light ops tooling)';

    public function handle(BalanceRegisterService $balanceRegisterService): int
    {
        $email = (string) $this->argument('employee_email');
        $amount = (float) $this->argument('amount');
        if ($amount <= 0) {
            $this->error('Amount must be greater than zero.');
            return self::FAILURE;
        }

        $user = User::where('email', $email)->first();
        if (! $user) {
            $this->error("Employee not found for email [{$email}].");
            return self::FAILURE;
        }

        $reference = $this->option('reference') ?: ('HIST-SA-' . strtoupper(Str::random(6)));
        if (SalaryAdvanceRequest::where('reference_number', $reference)->exists()) {
            $this->error("Reference [{$reference}] already exists.");
            return self::FAILURE;
        }

        $paidAt = $this->option('paid-at')
            ? Carbon::parse($this->option('paid-at'))
            : Carbon::now()->subMonths(2);
        $recovered = (bool) $this->option('recovered');
        $currency = (string) $this->option('currency');
        $purpose = (string) $this->option('purpose');

        $advance = DB::transaction(function () use (
            $user, $amount, $reference, $paidAt, $recovered, $currency, $purpose, $balanceRegisterService
        ) {
            $advance = SalaryAdvanceRequest::create([
                'tenant_id'         => $user->tenant_id,
                'requester_id'      => $user->id,
                'reference_number'  => $reference,
                'advance_type'      => 'other',
                'amount'            => $amount,
                'approved_amount'   => $amount,
                'currency'          => $currency,
                'repayment_months'  => 1,
                'purpose'           => $purpose,
                'justification'     => 'Imported opening balance via artisan salary-advance:import-opening-balance',
                'status'            => $recovered ? 'closed' : 'paid',
                'payment_status'    => 'paid',
                'recovery_status'   => $recovered ? 'recovered' : 'scheduled',
                'paid_at'           => $paidAt,
                'payment_reference' => 'OPENING-' . $reference,
                'payment_method'    => 'historical_import',
                'recovered_amount'  => $recovered ? $amount : 0,
                'closed_at'         => $recovered ? $paidAt->copy()->addMonth() : null,
                'intended_recovery_payroll_date' => $paidAt->copy()->endOfMonth()->toDateString(),
            ]);

            $actor = $user;
            $register = $balanceRegisterService->createFromSalaryAdvance($advance, $actor);

            // Opening disbursement already applied by createFromSalaryAdvance path —
            // ensure balance matches import intent.
            if ($recovered) {
                $balanceRegisterService->createTransaction($register, [
                    'type'          => 'recovery',
                    'amount'        => $amount,
                    'reference_doc' => 'SA-REC-' . $reference . '-OPENING',
                    'notes'         => 'Historical opening balance — fully recovered import',
                ], $actor);
                $register->refresh();
                $register->update(['status' => 'closed', 'balance' => 0]);
            }

            return $advance->fresh();
        });

        $this->info("Imported salary advance [{$advance->reference_number}] id={$advance->id} status={$advance->status}");

        return self::SUCCESS;
    }
}
