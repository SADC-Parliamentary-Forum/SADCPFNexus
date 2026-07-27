<?php

namespace App\Modules\Leave\Services;

use App\Models\LeavePayrollImpact;
use App\Models\LeaveRequest;
use App\Models\LeaveSegment;

class LeavePayrollImpactService
{
    public function __construct(private readonly LeaveSickLeaveService $sickLeaveService)
    {
    }

    public function recordForApprovedLeave(LeaveRequest $leave): void
    {
        $this->sickLeaveService->recordPayrollImpacts($leave);

        $leave->loadMissing('segments');

        foreach ($leave->segments as $segment) {
            match ($segment->leave_type) {
                'unpaid' => $this->recordImpact($leave, $segment, 'unpaid', [
                    'days' => (float) $segment->amount_requested,
                    'reason' => 'authorised_leave_without_pay',
                    'payroll_review_required' => true,
                    'leave_reference' => $leave->reference_number,
                ]),
                'maternity' => $this->recordImpact($leave, $segment, 'maternity_social_security_review', [
                    'calendar_days' => (float) $segment->calendar_days,
                    'working_days' => (float) $segment->amount_requested,
                    'social_security_tracking_required' => true,
                    'payroll_review_required' => true,
                    'leave_reference' => $leave->reference_number,
                ]),
                default => null,
            };
        }
    }

    /** @param array<string, mixed> $payload */
    private function recordImpact(LeaveRequest $leave, LeaveSegment $segment, string $payTreatment, array $payload): void
    {
        LeavePayrollImpact::firstOrCreate(
            [
                'leave_request_id' => $leave->id,
                'leave_type' => $segment->leave_type,
                'pay_treatment' => $payTreatment,
                'start_date' => $segment->start_date,
                'end_date' => $segment->end_date,
            ],
            [
                'tenant_id' => $leave->tenant_id,
                'user_id' => $leave->requester_id,
                'status' => 'pending',
                'payload' => array_merge($payload, [
                    'segment_id' => $segment->id,
                ]),
            ]
        );
    }
}
