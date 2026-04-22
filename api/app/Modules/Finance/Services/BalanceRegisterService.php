<?php

namespace App\Modules\Finance\Services;

use App\Models\AuditLog;
use App\Models\BalanceAcknowledgement;
use App\Models\BalanceRegister;
use App\Models\BalanceTransaction;
use App\Models\BalanceVerification;
use App\Models\ImprestRequest;
use App\Models\SalaryAdvanceRequest;
use App\Models\User;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class BalanceRegisterService
{
    public function __construct(protected NotificationService $notificationService) {}

    public function createFromSalaryAdvance(SalaryAdvanceRequest $advance, User $officer): BalanceRegister
    {
        if (BalanceRegister::where('source_request_type', SalaryAdvanceRequest::class)
            ->where('source_request_id', $advance->id)
            ->exists()) {
            throw ValidationException::withMessages(['register' => 'A balance register already exists for this advance.']);
        }

        $recoveryStart    = Carbon::now()->addMonthNoOverflow()->startOfMonth();
        $repaymentMonths  = (int) ($advance->repayment_months ?: 6);
        $installment      = $repaymentMonths > 0
            ? round((float) $advance->amount / $repaymentMonths, 2)
            : 0;
        $payoffDate       = $recoveryStart->copy()->addMonths($repaymentMonths);

        $register = BalanceRegister::create([
            'tenant_id'            => $advance->tenant_id,
            'module_type'          => 'salary_advance',
            'employee_id'          => $advance->requester_id,
            'source_request_type'  => SalaryAdvanceRequest::class,
            'source_request_id'    => $advance->id,
            'reference_number'     => 'BCR-' . strtoupper(Str::random(8)),
            'approved_amount'      => $advance->amount,
            'total_processed'      => 0,
            'balance'              => $advance->amount,
            'installment_amount'   => $installment,
            'recovery_start_date'  => $recoveryStart->toDateString(),
            'estimated_payoff_date'=> $payoffDate->toDateString(),
            'status'               => 'active',
            'created_by'           => $officer->id,
        ]);

        AuditLog::record('bcre.register_created', [
            'auditable_type' => BalanceRegister::class,
            'auditable_id'   => $register->id,
            'new_values'     => ['reference' => $register->reference_number, 'module' => 'salary_advance'],
            'tags'           => 'bcre',
        ]);

        $advance->loadMissing('requester');
        if ($advance->requester) {
            $this->notificationService->dispatch(
                $advance->requester,
                'bcre.register_created',
                [
                    'name'         => $advance->requester->name,
                    'reference'    => $register->reference_number,
                    'module_label' => 'Salary Advance',
                    'amount'       => number_format((float) $advance->amount, 2) . ' ' . $advance->currency,
                ],
                ['module' => 'bcre', 'record_id' => $register->id, 'url' => '/finance/balance-register/' . $register->id]
            );
        }

        return $register;
    }

    public function createFromImprest(ImprestRequest $imprest, User $officer): BalanceRegister
    {
        if (BalanceRegister::where('source_request_type', ImprestRequest::class)
            ->where('source_request_id', $imprest->id)
            ->exists()) {
            throw ValidationException::withMessages(['register' => 'A balance register already exists for this imprest.']);
        }

        $approvedAmount = (float) ($imprest->amount_approved ?? $imprest->amount_requested);

        $register = BalanceRegister::create([
            'tenant_id'           => $imprest->tenant_id,
            'module_type'         => 'imprest',
            'employee_id'         => $imprest->requester_id,
            'source_request_type' => ImprestRequest::class,
            'source_request_id'   => $imprest->id,
            'reference_number'    => 'BCR-' . strtoupper(Str::random(8)),
            'approved_amount'     => $approvedAmount,
            'total_processed'     => 0,
            'balance'             => $approvedAmount,
            'status'              => 'active',
            'created_by'          => $officer->id,
        ]);

        AuditLog::record('bcre.register_created', [
            'auditable_type' => BalanceRegister::class,
            'auditable_id'   => $register->id,
            'new_values'     => ['reference' => $register->reference_number, 'module' => 'imprest'],
            'tags'           => 'bcre',
        ]);

        $imprest->loadMissing('requester');
        if ($imprest->requester) {
            $this->notificationService->dispatch(
                $imprest->requester,
                'bcre.register_created',
                [
                    'name'         => $imprest->requester->name,
                    'reference'    => $register->reference_number,
                    'module_label' => 'Imprest',
                    'amount'       => number_format($approvedAmount, 2) . ' ' . $imprest->currency,
                ],
                ['module' => 'bcre', 'record_id' => $register->id, 'url' => '/finance/balance-register/' . $register->id]
            );
        }

        return $register;
    }

    public function createManual(array $data, User $officer): BalanceRegister
    {
        $moduleClassMap = [
            'salary_advance' => SalaryAdvanceRequest::class,
            'imprest'        => ImprestRequest::class,
        ];

        $sourceClass = $moduleClassMap[$data['module_type']] ?? null;
        if (!$sourceClass) {
            throw ValidationException::withMessages(['module_type' => 'Unsupported module type.']);
        }

        if (!$sourceClass::find($data['source_request_id'])) {
            throw ValidationException::withMessages(['source_request_id' => 'Source request not found.']);
        }

        if (BalanceRegister::where('source_request_type', $sourceClass)
            ->where('source_request_id', $data['source_request_id'])
            ->exists()) {
            throw ValidationException::withMessages(['register' => 'A balance register already exists for this request.']);
        }

        $approvedAmount = (float) $data['approved_amount'];

        $register = BalanceRegister::create([
            'tenant_id'           => $officer->tenant_id,
            'module_type'         => $data['module_type'],
            'employee_id'         => $data['employee_id'],
            'source_request_type' => $sourceClass,
            'source_request_id'   => $data['source_request_id'],
            'reference_number'    => 'BCR-' . strtoupper(Str::random(8)),
            'approved_amount'     => $approvedAmount,
            'total_processed'     => 0,
            'balance'             => $approvedAmount,
            'installment_amount'  => $data['installment_amount'] ?? null,
            'recovery_start_date' => $data['recovery_start_date'] ?? null,
            'estimated_payoff_date'=> $data['estimated_payoff_date'] ?? null,
            'status'              => 'active',
            'created_by'          => $officer->id,
        ]);

        AuditLog::record('bcre.register_created', [
            'auditable_type' => BalanceRegister::class,
            'auditable_id'   => $register->id,
            'new_values'     => ['reference' => $register->reference_number, 'manual' => true],
            'tags'           => 'bcre',
        ]);

        return $register;
    }

    public function createTransaction(BalanceRegister $register, array $data, User $maker): BalanceTransaction
    {
        abort_if($register->isLocked(), 422, 'This register is locked and cannot be updated.');

        $type   = $data['type'];
        $amount = (float) $data['amount'];

        if ($amount <= 0) {
            throw ValidationException::withMessages(['amount' => 'Amount must be greater than zero.']);
        }

        $validTypes = ['disbursement', 'recovery', 'adjustment', 'write_off'];
        if (!in_array($type, $validTypes)) {
            throw ValidationException::withMessages(['type' => 'Invalid transaction type.']);
        }

        $txn = DB::transaction(function () use ($register, $type, $amount, $data, $maker) {
            $previousBalance = (float) $register->balance;
            $newBalance      = in_array($type, ['recovery', 'write_off'])
                ? $previousBalance - $amount
                : $previousBalance + $amount;

            $txn = BalanceTransaction::create([
                'register_id'             => $register->id,
                'type'                    => $type,
                'amount'                  => $amount,
                'previous_balance'        => $previousBalance,
                'new_balance'             => $newBalance,
                'reference_doc'           => $data['reference_doc'] ?? null,
                'notes'                   => $data['notes'] ?? null,
                'supporting_document_path'=> $data['supporting_document_path'] ?? null,
                'created_by'              => $maker->id,
                'verification_status'     => 'pending',
            ]);

            $register->update([
                'balance'         => $newBalance,
                'total_processed' => (float) $register->total_processed + $amount,
            ]);

            BalanceAcknowledgement::create([
                'register_id'    => $register->id,
                'transaction_id' => $txn->id,
                'employee_id'    => $register->employee_id,
                'status'         => 'pending',
            ]);

            return $txn;
        });

        AuditLog::record('bcre.transaction_created', [
            'auditable_type' => BalanceRegister::class,
            'auditable_id'   => $register->id,
            'new_values'     => ['type' => $type, 'amount' => $amount, 'transaction_id' => $txn->id],
            'tags'           => 'bcre',
        ]);

        $register->loadMissing('employee');
        if ($register->employee) {
            $this->notificationService->dispatch(
                $register->employee,
                'bcre.balance_updated',
                [
                    'name'        => $register->employee->name,
                    'reference'   => $register->reference_number,
                    'type'        => ucfirst(str_replace('_', ' ', $type)),
                    'amount'      => number_format($amount, 2),
                    'new_balance' => number_format((float) $txn->new_balance, 2),
                ],
                ['module' => 'bcre', 'record_id' => $register->id, 'url' => '/finance/balance-register/' . $register->id]
            );
        }

        $checkers = User::role(['Finance Controller', 'Finance Officer'])
            ->where('tenant_id', $register->tenant_id)
            ->where('id', '!=', $maker->id)
            ->get();

        if ($checkers->isNotEmpty()) {
            $this->notificationService->dispatchToMany(
                $checkers,
                'bcre.verification_required',
                [
                    'reference' => $register->reference_number,
                    'maker'     => $maker->name,
                    'type'      => ucfirst(str_replace('_', ' ', $type)),
                    'amount'    => number_format($amount, 2),
                ],
                ['module' => 'bcre', 'record_id' => $register->id, 'url' => '/finance/balance-register/' . $register->id . '/verify?txn=' . $txn->id]
            );
        }

        return $txn->load(['createdBy', 'verification', 'acknowledgement']);
    }

    public function verifyTransaction(BalanceTransaction $txn, array $data, User $checker): BalanceVerification
    {
        abort_if(
            (int) $txn->created_by === (int) $checker->id,
            422,
            'You cannot verify your own transaction. A different officer must act as checker.'
        );

        if (!$txn->isPending()) {
            throw ValidationException::withMessages(['status' => 'This transaction has already been verified.']);
        }

        $register = $txn->register;
        abort_if($register->isLocked(), 422, 'This register is locked.');

        $status   = $data['status']; // approved, rejected, correction_requested
        $comments = $data['comments'] ?? null;

        $verification = DB::transaction(function () use ($txn, $register, $status, $comments, $checker) {
            $verification = BalanceVerification::create([
                'transaction_id' => $txn->id,
                'verified_by'    => $checker->id,
                'status'         => $status,
                'comments'       => $comments,
                'verified_at'    => now(),
            ]);

            $verificationStatus = $status === 'approved' ? 'approved' : 'rejected';
            $txn->update(['verification_status' => $verificationStatus]);

            if ($status === 'rejected') {
                // Reverse the balance impact
                $reversedBalance    = in_array($txn->type, ['recovery', 'write_off'])
                    ? (float) $register->balance + (float) $txn->amount
                    : (float) $register->balance - (float) $txn->amount;
                $reversedProcessed = max(0, (float) $register->total_processed - (float) $txn->amount);

                $register->update([
                    'balance'         => $reversedBalance,
                    'total_processed' => $reversedProcessed,
                ]);
            }

            return $verification;
        });

        AuditLog::record('bcre.transaction_verified', [
            'auditable_type' => BalanceRegister::class,
            'auditable_id'   => $register->id,
            'new_values'     => ['transaction_id' => $txn->id, 'status' => $status],
            'tags'           => 'bcre',
        ]);

        $txn->loadMissing('createdBy');
        if ($txn->createdBy) {
            $this->notificationService->dispatch(
                $txn->createdBy,
                'bcre.transaction_verified',
                [
                    'name'      => $txn->createdBy->name,
                    'reference' => $register->reference_number,
                    'status'    => $status,
                    'checker'   => $checker->name,
                    'comments'  => $comments ?? '',
                ],
                ['module' => 'bcre', 'record_id' => $register->id, 'url' => '/finance/balance-register/' . $register->id]
            );
        }

        return $verification->load('verifier');
    }

    public function acknowledge(BalanceRegister $register, array $data, User $employee): BalanceAcknowledgement
    {
        abort_if(
            (int) $register->employee_id !== (int) $employee->id,
            403,
            'You can only acknowledge your own balance register.'
        );

        $status       = $data['status']; // confirmed or disputed
        $disputeReason = $data['dispute_reason'] ?? null;

        if ($status === 'disputed' && empty($disputeReason)) {
            throw ValidationException::withMessages(['dispute_reason' => 'A reason is required when disputing a balance.']);
        }

        $ack = BalanceAcknowledgement::where('register_id', $register->id)
            ->where('employee_id', $employee->id)
            ->where('status', 'pending')
            ->latest()
            ->first();

        if (!$ack) {
            $ack = BalanceAcknowledgement::create([
                'register_id' => $register->id,
                'employee_id' => $employee->id,
                'status'      => 'pending',
            ]);
        }

        $ack->update([
            'status'         => $status,
            'dispute_reason' => $disputeReason,
            'responded_at'   => now(),
        ]);

        if ($status === 'disputed') {
            $register->update(['status' => 'disputed']);

            $controllers = User::role('Finance Controller')
                ->where('tenant_id', $register->tenant_id)
                ->get();

            if ($controllers->isNotEmpty()) {
                $this->notificationService->dispatchToMany(
                    $controllers,
                    'bcre.balance_disputed',
                    [
                        'reference' => $register->reference_number,
                        'employee'  => $employee->name,
                        'reason'    => $disputeReason,
                    ],
                    ['module' => 'bcre', 'record_id' => $register->id, 'url' => '/finance/balance-register/' . $register->id]
                );
            }
        }

        AuditLog::record('bcre.acknowledged', [
            'auditable_type' => BalanceRegister::class,
            'auditable_id'   => $register->id,
            'new_values'     => ['status' => $status, 'employee_id' => $employee->id],
            'tags'           => 'bcre',
        ]);

        return $ack;
    }

    public function lockPeriod(BalanceRegister $register, User $controller): BalanceRegister
    {
        abort_if(
            !$controller->hasRole('Finance Controller'),
            403,
            'Only a Finance Controller can lock a register period.'
        );

        $pendingCount = $register->transactions()->where('verification_status', 'pending')->count();
        if ($pendingCount > 0) {
            throw ValidationException::withMessages([
                'pending' => "Cannot lock: {$pendingCount} transaction(s) are still pending verification.",
            ]);
        }

        $register->update([
            'status'          => 'locked',
            'period_locked_at'=> now(),
            'locked_by'       => $controller->id,
        ]);

        AuditLog::record('bcre.period_locked', [
            'auditable_type' => BalanceRegister::class,
            'auditable_id'   => $register->id,
            'new_values'     => ['locked_by' => $controller->id],
            'tags'           => 'bcre',
        ]);

        $register->loadMissing('employee');
        if ($register->employee) {
            $this->notificationService->dispatch(
                $register->employee,
                'bcre.period_locked',
                [
                    'name'       => $register->employee->name,
                    'reference'  => $register->reference_number,
                    'controller' => $controller->name,
                ],
                ['module' => 'bcre', 'record_id' => $register->id, 'url' => '/finance/balance-register/' . $register->id]
            );
        }

        return $register->fresh();
    }

    public function unlockPeriod(BalanceRegister $register, User $controller): BalanceRegister
    {
        abort_if(
            !$controller->hasRole('Finance Controller'),
            403,
            'Only a Finance Controller can unlock a register period.'
        );

        $register->update([
            'status'           => 'active',
            'period_locked_at' => null,
            'locked_by'        => null,
        ]);

        AuditLog::record('bcre.period_unlocked', [
            'auditable_type' => BalanceRegister::class,
            'auditable_id'   => $register->id,
            'new_values'     => ['unlocked_by' => $controller->id],
            'tags'           => 'bcre',
        ]);

        return $register->fresh();
    }

    public function list(array $filters, User $user): LengthAwarePaginator
    {
        $query = BalanceRegister::with(['employee', 'createdBy'])
            ->withCount('transactions')
            ->orderByDesc('created_at');

        if (!($user->hasAnyRole(['Finance Controller', 'Finance Officer', 'System Admin', 'Secretary General'])
            || $user->isSystemAdmin())) {
            $query->where('employee_id', $user->id);
        } else {
            $query->where('tenant_id', $user->tenant_id);
        }

        if (!empty($filters['module_type'])) {
            $query->where('module_type', $filters['module_type']);
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['employee_id'])) {
            $query->where('employee_id', $filters['employee_id']);
        }

        return $query->paginate($filters['per_page'] ?? 20);
    }

    public function dashboard(User $user): array
    {
        $base = BalanceRegister::where('tenant_id', $user->tenant_id);

        $totalActive     = (clone $base)->where('status', 'active')->count();
        $totalBalance    = (clone $base)->where('status', 'active')->sum('balance');
        $disputed        = (clone $base)->where('status', 'disputed')->count();

        $pendingVerifications = BalanceTransaction::whereIn(
            'register_id',
            (clone $base)->pluck('id')
        )->where('verification_status', 'pending')->count();

        $byModule = (clone $base)->where('status', 'active')
            ->selectRaw('module_type, COUNT(*) as cnt')
            ->groupBy('module_type')
            ->pluck('cnt', 'module_type')
            ->toArray();

        return [
            'total_active_registers'  => $totalActive,
            'total_outstanding_balance'=> (float) $totalBalance,
            'pending_verifications'   => $pendingVerifications,
            'disputed_registers'      => $disputed,
            'registers_by_module'     => $byModule,
        ];
    }

    public function exceptions(User $user): LengthAwarePaginator
    {
        $query = BalanceRegister::with(['employee', 'createdBy'])
            ->where('tenant_id', $user->tenant_id)
            ->where(function ($q) {
                $q->where('status', 'disputed')
                    ->orWhereHas('transactions', function ($tq) {
                        $tq->where('verification_status', 'pending')
                            ->where('created_at', '<', now()->subHours(72));
                    });
            })
            ->orderByDesc('updated_at');

        return $query->paginate(20);
    }
}
