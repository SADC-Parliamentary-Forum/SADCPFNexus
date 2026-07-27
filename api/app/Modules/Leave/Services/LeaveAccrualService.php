<?php

namespace App\Modules\Leave\Services;

use App\Models\LeaveLedgerEntry;
use App\Models\LeaveType;
use App\Models\Tenant;
use App\Models\User;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

class LeaveAccrualService
{
    public function __construct(private readonly LeavePolicyService $policyService)
    {
    }

    /** @return array<string, int|string> */
    public function postMonthlyAnnualAccruals(?int $tenantId = null, ?CarbonInterface $month = null, bool $dryRun = false): array
    {
        $period = $month
            ? CarbonImmutable::parse($month->toDateString())->startOfMonth()
            : CarbonImmutable::now()->startOfMonth();
        $effectiveDate = $period->endOfMonth();
        $reference = 'ANNUAL-ACCRUAL-' . $period->format('Y-m');

        $summary = [
            'period' => $period->format('Y-m'),
            'reference' => $reference,
            'tenants_processed' => 0,
            'tenants_without_config' => 0,
            'users_considered' => 0,
            'entries_posted' => 0,
            'entries_would_post' => 0,
            'duplicates_skipped' => 0,
        ];

        Tenant::query()
            ->where('is_active', true)
            ->when($tenantId, fn ($query) => $query->whereKey($tenantId))
            ->orderBy('id')
            ->each(function (Tenant $tenant) use (&$summary, $effectiveDate, $reference, $dryRun) {
                $summary['tenants_processed']++;

                $policy = $this->policyService->activePolicyForTenant($tenant->id, $effectiveDate);
                $annualType = LeaveType::query()
                    ->where('tenant_id', $tenant->id)
                    ->where('code', 'annual')
                    ->where('is_active', true)
                    ->first();

                $amount = $annualType ? $this->monthlyAccrualAmount($annualType) : 0.0;

                if (! $annualType || $amount <= 0) {
                    $summary['tenants_without_config']++;

                    return;
                }

                User::query()
                    ->where('tenant_id', $tenant->id)
                    ->where('is_active', true)
                    ->whereNull('vendor_id')
                    ->orderBy('id')
                    ->each(function (User $user) use (&$summary, $tenant, $policy, $annualType, $amount, $effectiveDate, $reference, $dryRun) {
                        $summary['users_considered']++;

                        $exists = LeaveLedgerEntry::query()
                            ->where('tenant_id', $tenant->id)
                            ->where('user_id', $user->id)
                            ->where('leave_type', 'annual')
                            ->where('transaction_type', LeaveLedgerEntry::ACCRUAL)
                            ->where('reference', $reference)
                            ->exists();

                        if ($exists) {
                            $summary['duplicates_skipped']++;

                            return;
                        }

                        if ($dryRun) {
                            $summary['entries_would_post']++;

                            return;
                        }

                        DB::transaction(function () use (&$summary, $tenant, $policy, $annualType, $user, $amount, $effectiveDate, $reference) {
                            $alreadyPosted = LeaveLedgerEntry::query()
                                ->where('tenant_id', $tenant->id)
                                ->where('user_id', $user->id)
                                ->where('leave_type', 'annual')
                                ->where('transaction_type', LeaveLedgerEntry::ACCRUAL)
                                ->where('reference', $reference)
                                ->lockForUpdate()
                                ->exists();

                            if ($alreadyPosted) {
                                $summary['duplicates_skipped']++;

                                return;
                            }

                            $runningBalance = (float) LeaveLedgerEntry::query()
                                ->where('tenant_id', $tenant->id)
                                ->where('user_id', $user->id)
                                ->where('leave_type', 'annual')
                                ->lockForUpdate()
                                ->get(['amount'])
                                ->sum('amount');

                            LeaveLedgerEntry::create([
                                'tenant_id' => $tenant->id,
                                'user_id' => $user->id,
                                'leave_type_id' => $annualType->id,
                                'policy_version_id' => $policy->id,
                                'leave_type' => 'annual',
                                'transaction_type' => LeaveLedgerEntry::ACCRUAL,
                                'amount' => round($amount, 2),
                                'unit' => 'days',
                                'effective_date' => $effectiveDate->toDateString(),
                                'source_type' => 'monthly_accrual',
                                'reference' => $reference,
                                'balance_after' => round($runningBalance + $amount, 2),
                                'reason' => 'Monthly annual leave accrual',
                            ]);

                            $summary['entries_posted']++;
                        });
                    });
            });

        return $summary;
    }

    private function monthlyAccrualAmount(LeaveType $annualType): float
    {
        $rate = (float) ($annualType->accrual_rate ?? 0);
        $unit = strtolower((string) ($annualType->accrual_unit ?? ''));

        if ($rate > 0 && in_array($unit, ['month', 'monthly'], true)) {
            return $rate;
        }

        $annualEntitlement = (float) ($annualType->annual_entitlement ?? 0);

        if ($annualEntitlement > 0) {
            return $annualEntitlement / 12;
        }

        return 0.0;
    }
}
