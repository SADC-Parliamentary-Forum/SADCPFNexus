<?php

namespace App\Modules\Leave\Services;

use App\Models\LeavePolicyVersion;
use App\Models\LeaveType;
use App\Models\Tenant;
use Carbon\CarbonInterface;

class LeavePolicyService
{
    /** @return array<string, array<string, mixed>> */
    public function defaultTypeDefinitions(): array
    {
        return [
            'annual' => ['name' => 'Annual Leave', 'cycle' => 'employment_cycle', 'is_paid' => true],
            'sick' => ['name' => 'Sick Leave', 'cycle' => 'contract_four_year', 'is_paid' => true, 'medical_certificate_after_days' => 2],
            'lil' => ['name' => 'Leave in Lieu of Overtime', 'cycle' => 'credit_expiry', 'is_paid' => true],
            'unpaid' => ['name' => 'Authorised Leave Without Pay', 'cycle' => 'calendar_year', 'is_paid' => false],
            'study' => ['name' => 'Study Leave', 'cycle' => 'calendar_year', 'is_paid' => true],
            'home' => ['name' => 'Home Leave', 'cycle' => 'service_interval', 'is_paid' => true],
            'maternity' => ['name' => 'Maternity Leave', 'cycle' => 'event', 'is_paid' => true],
            'paternity' => ['name' => 'Paternity Leave', 'cycle' => 'two_year_interval', 'is_paid' => true],
            'compassionate' => ['name' => 'Compassionate Leave', 'cycle' => 'calendar_year', 'is_paid' => true],
            'special' => ['name' => 'Special Leave', 'cycle' => 'policy', 'is_paid' => true],
        ];
    }

    public function activePolicyForTenant(int $tenantId, ?CarbonInterface $date = null): LeavePolicyVersion
    {
        $date ??= now();

        $policy = LeavePolicyVersion::query()
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->whereDate('effective_from', '<=', $date->toDateString())
            ->where(function ($q) use ($date) {
                $q->whereNull('effective_to')
                    ->orWhereDate('effective_to', '>=', $date->toDateString());
            })
            ->orderByDesc('effective_from')
            ->first();

        if (! $policy) {
            $policy = LeavePolicyVersion::create([
                'tenant_id' => $tenantId,
                'name' => 'SADC PF Leave Policy',
                'version' => 'v1',
                'effective_from' => '2026-01-01',
                'rules' => [
                    'annual_entitlement_configured_by_hr' => true,
                    'annual_leave_may_not_be_taken_in_advance' => true,
                    'public_holidays_excluded_from_annual_leave' => true,
                    'toil_expires_after_days' => 30,
                ],
                'is_active' => true,
            ]);
        }

        $this->ensureDefaultTypes($policy);

        return $policy->fresh(['types']);
    }

    public function leaveType(int $tenantId, string $code): ?LeaveType
    {
        $this->activePolicyForTenant($tenantId);

        return LeaveType::query()
            ->where('tenant_id', $tenantId)
            ->where('code', $code)
            ->where('is_active', true)
            ->first();
    }

    public function ensureDefaultTypes(LeavePolicyVersion $policy): void
    {
        foreach ($this->defaultTypeDefinitions() as $code => $definition) {
            LeaveType::firstOrCreate(
                ['tenant_id' => $policy->tenant_id, 'code' => $code],
                array_merge($definition, [
                    'policy_version_id' => $policy->id,
                    'allow_negative_balance' => false,
                    'allow_half_day' => false,
                    'requires_attachment' => false,
                    'is_active' => true,
                ])
            );
        }
    }

    public function ensureForAllTenants(): void
    {
        Tenant::query()->select('id')->each(fn (Tenant $tenant) => $this->activePolicyForTenant($tenant->id));
    }
}
