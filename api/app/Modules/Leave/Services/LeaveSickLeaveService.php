<?php

namespace App\Modules\Leave\Services;

use App\Models\HrPersonalFile;
use App\Models\LeavePayrollImpact;
use App\Models\LeaveRequest;
use App\Models\LeaveSegment;
use App\Models\LeaveType;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

class LeaveSickLeaveService
{
    public function __construct(private readonly LeavePolicyService $policyService)
    {
    }

    public function assertWithinCycleEntitlement(LeaveRequest $leave, LeaveSegment $segment, ?LeaveType $type, ?HrPersonalFile $hrFile): void
    {
        $tiers = $this->tiers($type);
        $used = $this->usedBefore($leave, $segment, $hrFile);
        $requested = (float) $segment->amount_requested;
        $maximum = $tiers['full_pay_days'] + $tiers['half_pay_days'] + $tiers['unpaid_days'];

        if ($used + $requested > $maximum) {
            throw ValidationException::withMessages([
                'sick' => "This sick-leave request exceeds the remaining sick-leave entitlement for the four-year contract cycle.",
            ]);
        }
    }

    public function applyPayTreatment(LeaveRequest $leave, LeaveSegment $segment, ?HrPersonalFile $hrFile = null): void
    {
        if ($segment->leave_type !== 'sick') {
            return;
        }

        $type = $this->policyService->leaveType($leave->tenant_id, 'sick');
        $classification = $this->classify($leave, $segment, $type, $hrFile);

        $segment->update(['pay_treatment' => $classification['pay_treatment']]);
    }

    public function recordPayrollImpacts(LeaveRequest $leave): void
    {
        $leave->loadMissing(['requester', 'segments']);
        $hrFile = HrPersonalFile::query()
            ->where('tenant_id', $leave->tenant_id)
            ->where('employee_id', $leave->requester_id)
            ->first();

        foreach ($leave->segments as $segment) {
            if ($segment->leave_type !== 'sick') {
                continue;
            }

            $type = $this->policyService->leaveType($leave->tenant_id, 'sick');
            $classification = $this->classify($leave, $segment, $type, $hrFile);
            $segment->update(['pay_treatment' => $classification['pay_treatment']]);

            foreach ($classification['allocations'] as $allocation) {
                if (! in_array($allocation['pay_treatment'], ['half_pay', 'unpaid'], true) || $allocation['days'] <= 0) {
                    continue;
                }

                LeavePayrollImpact::firstOrCreate(
                    [
                        'leave_request_id' => $leave->id,
                        'pay_treatment' => $allocation['pay_treatment'],
                        'start_date' => $segment->start_date,
                        'end_date' => $segment->end_date,
                    ],
                    [
                        'tenant_id' => $leave->tenant_id,
                        'user_id' => $leave->requester_id,
                        'leave_type' => 'sick',
                        'status' => 'pending',
                        'payload' => [
                            'days' => $allocation['days'],
                            'cycle_start' => $classification['cycle_start'],
                            'cycle_end' => $classification['cycle_end'],
                            'used_before' => $classification['used_before'],
                            'segment_id' => $segment->id,
                            'leave_reference' => $leave->reference_number,
                        ],
                    ]
                );
            }
        }
    }

    /** @return array{pay_treatment:string, allocations:list<array{pay_treatment:string, days:float}>} */
    public function classifyPayTreatment(float $usedBefore, float $requested, ?LeaveType $type = null): array
    {
        $tiers = $this->tiers($type);
        $remaining = $requested;
        $cursor = $usedBefore;
        $allocations = [];

        foreach ([
            'full_pay' => $tiers['full_pay_days'],
            'half_pay' => $tiers['half_pay_days'],
            'unpaid' => $tiers['unpaid_days'],
        ] as $payTreatment => $tierLimit) {
            if ($remaining <= 0) {
                break;
            }

            $tierStart = $this->tierStart($payTreatment, $tiers);
            $tierEnd = $tierStart + $tierLimit;

            if ($cursor >= $tierEnd) {
                continue;
            }

            $available = max(0, $tierEnd - max($cursor, $tierStart));
            $days = round(min($remaining, $available), 2);

            if ($days > 0) {
                $allocations[] = ['pay_treatment' => $payTreatment, 'days' => $days];
                $remaining = round($remaining - $days, 2);
                $cursor = round($cursor + $days, 2);
            }
        }

        $treatments = collect($allocations)->pluck('pay_treatment')->unique()->values();

        return [
            'pay_treatment' => $treatments->count() === 1 ? (string) $treatments->first() : 'mixed',
            'allocations' => $allocations,
        ];
    }

    /** @return array{pay_treatment:string, allocations:list<array{pay_treatment:string, days:float}>, used_before:float, cycle_start:string, cycle_end:string} */
    private function classify(LeaveRequest $leave, LeaveSegment $segment, ?LeaveType $type, ?HrPersonalFile $hrFile): array
    {
        $usedBefore = $this->usedBefore($leave, $segment, $hrFile);
        $classification = $this->classifyPayTreatment($usedBefore, (float) $segment->amount_requested, $type);

        $window = $this->cycleWindow($leave, $segment, $hrFile);

        return [
            'pay_treatment' => $classification['pay_treatment'],
            'allocations' => $classification['allocations'],
            'used_before' => round($usedBefore, 2),
            'cycle_start' => $window['start']->toDateString(),
            'cycle_end' => $window['end']->toDateString(),
        ];
    }

    /** @return array{full_pay_days:float, half_pay_days:float, unpaid_days:float} */
    private function tiers(?LeaveType $type): array
    {
        return [
            'full_pay_days' => (float) ($type?->rules['full_pay_days'] ?? 60),
            'half_pay_days' => (float) ($type?->rules['half_pay_days'] ?? 60),
            'unpaid_days' => (float) ($type?->rules['unpaid_days'] ?? 60),
        ];
    }

    /** @param array{full_pay_days:float, half_pay_days:float, unpaid_days:float} $tiers */
    private function tierStart(string $payTreatment, array $tiers): float
    {
        return match ($payTreatment) {
            'half_pay' => $tiers['full_pay_days'],
            'unpaid' => $tiers['full_pay_days'] + $tiers['half_pay_days'],
            default => 0.0,
        };
    }

    private function usedBefore(LeaveRequest $leave, LeaveSegment $segment, ?HrPersonalFile $hrFile): float
    {
        $window = $this->cycleWindow($leave, $segment, $hrFile);

        $segmentUsed = (float) LeaveSegment::query()
            ->where('leave_type', 'sick')
            ->whereHas('leaveRequest', function ($query) use ($leave, $window) {
                $query->where('tenant_id', $leave->tenant_id)
                    ->where('requester_id', $leave->requester_id)
                    ->where('id', '!=', $leave->id)
                    ->where('status', 'approved')
                    ->whereBetween('start_date', [$window['start']->toDateString(), $window['end']->toDateString()]);
            })
            ->sum('amount_requested');

        $legacyUsed = (float) LeaveRequest::query()
            ->where('tenant_id', $leave->tenant_id)
            ->where('requester_id', $leave->requester_id)
            ->where('id', '!=', $leave->id)
            ->where('leave_type', 'sick')
            ->where('status', 'approved')
            ->whereDoesntHave('segments')
            ->whereBetween('start_date', [$window['start']->toDateString(), $window['end']->toDateString()])
            ->sum('days_requested');

        return round($segmentUsed + $legacyUsed, 2);
    }

    /** @return array{start:Carbon, end:Carbon} */
    private function cycleWindow(LeaveRequest $leave, LeaveSegment $segment, ?HrPersonalFile $hrFile): array
    {
        $segmentStart = Carbon::parse($segment->start_date)->startOfDay();
        $serviceStart = $hrFile?->appointment_date
            ? Carbon::parse($hrFile->appointment_date)->startOfDay()
            : ($leave->requester?->join_date ? Carbon::parse($leave->requester->join_date)->startOfDay() : $segmentStart->copy()->startOfYear());

        if ($serviceStart->gt($segmentStart)) {
            $serviceStart = $segmentStart->copy();
        }

        $months = (int) floor($serviceStart->diffInMonths($segmentStart));
        $cycleOffset = intdiv($months, 48) * 48;
        $cycleStart = $serviceStart->copy()->addMonths($cycleOffset)->startOfDay();
        $cycleEnd = $cycleStart->copy()->addYears(4)->subDay()->endOfDay();

        return ['start' => $cycleStart, 'end' => $cycleEnd];
    }
}
