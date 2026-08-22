<?php

namespace App\Modules\Lifecycle\Services;

use App\Models\HrContractType;
use App\Models\HrGradeBand;
use App\Models\HrPersonalFile;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class NoticeRuleService
{
    /**
     * Resolve notice period and probation from published HR policy — never hardcoded literals.
     *
     * @return array{
     *   notice_period_days: int,
     *   probation_months: int|null,
     *   grade_band_id: int|null,
     *   grade_band_code: string|null,
     *   contract_type_id: int|null,
     *   contract_type_code: string|null,
     *   source: string
     * }
     */
    public function resolve(User $employee, ?int $gradeBandId = null, ?int $contractTypeId = null): array
    {
        $tenantId = $employee->tenant_id;
        $hrFile = HrPersonalFile::where('tenant_id', $tenantId)
            ->where('employee_id', $employee->id)
            ->first();

        if (! $gradeBandId && $hrFile?->grade_scale) {
            $gradeBandId = HrGradeBand::where('tenant_id', $tenantId)
                ->where('code', $hrFile->grade_scale)
                ->where('status', 'published')
                ->value('id');
        }

        if (! $contractTypeId && $hrFile?->contract_type) {
            $contractTypeId = HrContractType::where('tenant_id', $tenantId)
                ->where('code', $hrFile->contract_type)
                ->where('is_active', true)
                ->value('id');
        }

        if ($gradeBandId) {
            $band = HrGradeBand::where('tenant_id', $tenantId)
                ->where('id', $gradeBandId)
                ->where('status', 'published')
                ->first();

            if ($band) {
                return [
                    'notice_period_days' => (int) $band->notice_period_days,
                    'probation_months' => $band->probation_months,
                    'grade_band_id' => $band->id,
                    'grade_band_code' => $band->code,
                    'contract_type_id' => $band->contract_type_id,
                    'contract_type_code' => $band->contractType?->code,
                    'source' => 'grade_band',
                ];
            }
        }

        if ($contractTypeId) {
            $contract = HrContractType::where('tenant_id', $tenantId)
                ->where('id', $contractTypeId)
                ->where('is_active', true)
                ->first();

            if ($contract) {
                return [
                    'notice_period_days' => (int) $contract->notice_period_days,
                    'probation_months' => $contract->has_probation ? $contract->probation_months : null,
                    'grade_band_id' => null,
                    'grade_band_code' => null,
                    'contract_type_id' => $contract->id,
                    'contract_type_code' => $contract->code,
                    'source' => 'contract_type',
                ];
            }
        }

        throw ValidationException::withMessages([
            'policy' => 'No published notice/probation policy found for this employee.',
        ]);
    }

    public function noticeEndDate(\DateTimeInterface $separationInitiated, array $noticeSnapshot): \Carbon\Carbon
    {
        $days = (int) ($noticeSnapshot['notice_period_days'] ?? 0);

        return \Carbon\Carbon::parse($separationInitiated)->addDays($days);
    }
}
