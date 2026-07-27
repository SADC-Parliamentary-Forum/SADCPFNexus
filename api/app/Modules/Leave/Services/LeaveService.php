<?php

namespace App\Modules\Leave\Services;

use App\Models\AuditLog;
use App\Models\HrPersonalFile;
use App\Models\LeaveBalance;
use App\Models\LeaveLedgerEntry;
use App\Models\LeaveRequest;
use App\Models\LeaveSegment;
use App\Models\LeaveType;
use App\Models\OvertimeAccrual;
use App\Models\ToilCredit;
use App\Models\TravelToilCandidate;
use App\Models\User;
use App\Models\WorkplanEvent;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LeaveService
{
    public function __construct(
        protected \App\Services\WorkflowService $workflowService,
        protected NotificationService $notificationService,
        protected LeavePolicyService $policyService,
        protected LeaveCalendarService $calendarService,
        protected LeaveBalanceService $balanceService,
        protected LeaveToilCreditService $toilCreditService,
        protected LeaveSickLeaveService $sickLeaveService,
        protected LeavePayrollImpactService $payrollImpactService,
    ) {}

    public function list(array $filters, User $user): LengthAwarePaginator
    {
        $query = LeaveRequest::with(['requester', 'segments'])
            ->where('tenant_id', $user->tenant_id)
            ->orderByDesc('created_at');

        if ($user->hasRole('staff')) {
            $query->where('requester_id', $user->id);
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['leave_type'])) {
            $query->where('leave_type', $filters['leave_type']);
        }

        return $query->paginate($filters['per_page'] ?? 20);
    }

    /** @return list<array<string, mixed>> */
    public function previewSegments(User $user, array $segmentInputs, ?int $ignoreLeaveRequestId = null): array
    {
        $this->policyService->activePolicyForTenant($user->tenant_id);

        return collect($segmentInputs)->map(function (array $segment) use ($user, $ignoreLeaveRequestId) {
            $leaveType = $segment['leave_type'];
            if (Carbon::parse($segment['end_date'])->lt(Carbon::parse($segment['start_date']))) {
                throw ValidationException::withMessages([
                    'segments' => ['Each leave segment end date must be on or after its start date.'],
                ]);
            }

            $type = $this->policyService->leaveType($user->tenant_id, $leaveType);
            if (! $type) {
                throw ValidationException::withMessages(['leave_type' => "Unsupported leave type: {$leaveType}."]);
            }

            $calc = $this->calendarService->calculate(
                $user,
                $segment['start_date'],
                $segment['end_date'],
                $segment['day_part'] ?? 'full',
                $segment['country_code'] ?? null
            );

            $amount = (float) ($segment['amount_requested'] ?? $calc['working_days']);
            $balance = $this->balanceService->balanceFor($user, $leaveType, Carbon::parse($segment['start_date']), $ignoreLeaveRequestId);

            if ($leaveType === 'lil') {
                $this->prepareToilSource($user, $segment, $amount);
            }

            return [
                'leave_type_id' => $type->id,
                'leave_type' => $leaveType,
                'start_date' => $segment['start_date'],
                'end_date' => $segment['end_date'],
                'day_part' => $segment['day_part'] ?? 'full',
                'calendar_days' => $calc['calendar_days'],
                'weekend_days' => $calc['weekend_days'],
                'public_holidays_excluded' => $calc['public_holidays_excluded'],
                'working_days' => $calc['working_days'],
                'balance_before' => $balance['available'],
                'amount_requested' => $amount,
                'balance_after' => round(((float) $balance['available']) - $amount, 2),
                'source_type' => $segment['source_type'] ?? null,
                'source_id' => $segment['source_id'] ?? null,
                'pay_treatment' => $segment['pay_treatment'] ?? ($type->is_paid ? 'full_pay' : 'unpaid'),
                'document_status' => $segment['document_status'] ?? null,
                'status' => 'draft',
                'comments' => $segment['comments'] ?? null,
                'holidays' => $calc['holidays'],
            ];
        })->values()->all();
    }

    public function create(array $data, User $user): LeaveRequest
    {
        $hrFile = \App\Models\HrPersonalFile::where('tenant_id', $user->tenant_id)
            ->where('employee_id', $user->id)
            ->first();
        if ($hrFile?->hr_managed_externally) {
            throw ValidationException::withMessages([
                'general' => ['Your leave is managed by your host parliament. Leave requests cannot be submitted through this system.'],
            ]);
        }

        $policy = $this->policyService->activePolicyForTenant($user->tenant_id);
        $segments = $this->previewSegments($user, $this->normaliseSegmentInputs($data));
        $this->assertSegmentsDoNotOverlap($segments);

        $startDate = Carbon::parse(collect($segments)->min('start_date'));
        $endDate = Carbon::parse(collect($segments)->max('end_date'));
        $daysRequested = (float) collect($segments)->sum('amount_requested');
        $hasLil = collect($segments)->contains(fn ($segment) => $segment['leave_type'] === 'lil');

        $conflicts = app(\App\Modules\Travel\Services\TravelConflictService::class)
            ->detectForLeave($user, $startDate->toDateString(), $endDate->toDateString());
        if (! empty($conflicts) && empty($data['acknowledge_conflicts'])) {
            throw ValidationException::withMessages([
                'conflicts' => array_map(fn ($c) => $c['message'], $conflicts),
            ]);
        }

        $leave = DB::transaction(function () use ($data, $user, $policy, $segments, $startDate, $endDate, $daysRequested, $hasLil) {
            $leave = LeaveRequest::create([
                'tenant_id' => $user->tenant_id,
                'requester_id' => $user->id,
                'policy_version_id' => $policy->id,
                'reference_number' => 'LVE-' . strtoupper(Str::random(8)),
                'leave_type' => $segments[0]['leave_type'],
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'days_requested' => (int) round($daysRequested),
                'reason' => $data['reason'] ?? null,
                'leave_address' => $data['leave_address'] ?? null,
                'contact_number' => $data['contact_number'] ?? null,
                'emergency_contact' => $data['emergency_contact'] ?? null,
                'handover_required' => (bool) ($data['handover_required'] ?? false),
                'handover_notes' => $data['handover_notes'] ?? null,
                'status' => 'draft',
                'current_stage' => 'Draft',
                'current_holder' => $user->name,
                'has_lil_linking' => $hasLil,
                'lil_hours_required' => $hasLil ? $daysRequested * 8 : null,
            ]);

            foreach ($segments as $segment) {
                unset($segment['holidays']);
                $leave->segments()->create($segment);
            }

            if ($hasLil && ! empty($data['lil_linkings'])) {
                $this->attachLegacyLilLinkings($leave, $data['lil_linkings'], $user);
            }

            return $leave;
        });

        AuditLog::record('leave.created', [
            'auditable_type' => LeaveRequest::class,
            'auditable_id' => $leave->id,
            'new_values' => ['reference' => $leave->reference_number, 'type' => $leave->leave_type],
            'tags' => 'leave',
        ]);

        return $leave->load(['requester', 'lilLinkings', 'segments.type', 'policyVersion']);
    }

    public function update(LeaveRequest $leave, array $data, User $user): LeaveRequest
    {
        if (! $leave->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft requests can be edited.']);
        }

        if ((int) $leave->requester_id !== (int) $user->id && ! $user->isSystemAdmin()) {
            abort(403, 'You can only edit your own leave requests.');
        }

        $updates = array_filter([
            'leave_type' => $data['leave_type'] ?? null,
            'start_date' => $data['start_date'] ?? null,
            'end_date' => $data['end_date'] ?? null,
            'reason' => $data['reason'] ?? null,
            'leave_address' => $data['leave_address'] ?? null,
            'contact_number' => $data['contact_number'] ?? null,
            'emergency_contact' => $data['emergency_contact'] ?? null,
            'handover_required' => $data['handover_required'] ?? null,
            'handover_notes' => $data['handover_notes'] ?? null,
        ], fn ($v) => $v !== null);

        if (! empty($updates['start_date']) || ! empty($updates['end_date'])) {
            $start = Carbon::parse($updates['start_date'] ?? $leave->start_date);
            $end = Carbon::parse($updates['end_date'] ?? $leave->end_date);
            $calc = $this->calendarService->calculate($leave->requester, $start->toDateString(), $end->toDateString());
            $updates['days_requested'] = (int) round($calc['working_days']);
            if (($updates['leave_type'] ?? $leave->leave_type) === 'lil') {
                $updates['lil_hours_required'] = $updates['days_requested'] * 8;
            }
        }

        $leave->update($updates);

        AuditLog::record('leave.updated', [
            'auditable_type' => LeaveRequest::class,
            'auditable_id' => $leave->id,
            'tags' => 'leave',
        ]);

        return $leave->fresh(['requester', 'lilLinkings', 'segments.type']);
    }

    public function submit(LeaveRequest $leave, User $user): LeaveRequest
    {
        if (! $leave->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft requests can be submitted.']);
        }

        if ($leave->lilLinkings()->exists() && $leave->lil_hours_linked < $leave->lil_hours_required) {
            throw ValidationException::withMessages(['lil' => 'You must link sufficient LIL hours before submitting.']);
        }

        $leave->loadMissing(['requester', 'segments']);
        if ($leave->segments->isEmpty()) {
            $segments = $this->previewSegments($leave->requester, $this->normaliseSegmentInputs($leave->toArray()), $leave->id);
            foreach ($segments as $segment) {
                unset($segment['holidays']);
                $leave->segments()->create($segment);
            }
            $leave->load('segments');
        }
        $this->validateSegmentsForSubmission($leave);

        $leave->update([
            'status' => 'submitted',
            'submitted_at' => now(),
            'current_stage' => 'Supervisor/HOD Recommendation',
            'current_holder' => 'Supervisor/HOD',
        ]);

        $this->workflowService->initiate($leave, 'leave', $user);

        $approvers = User::role(['HR Manager', 'HR Administrator', 'Secretary General'])
            ->where('tenant_id', $user->tenant_id)
            ->where('id', '!=', $user->id)
            ->get();
        $this->notificationService->dispatchToMany($approvers, 'leave.submitted', [
            'reference' => $leave->reference_number,
            'requester' => $user->name,
            'leave_type' => ucfirst(str_replace('_', ' ', $leave->leave_type)),
            'start_date' => $leave->start_date,
            'end_date' => $leave->end_date,
        ], ['module' => 'leave', 'record_id' => $leave->id, 'url' => '/leave/' . $leave->id]);

        AuditLog::record('leave.submitted', [
            'auditable_type' => LeaveRequest::class,
            'auditable_id' => $leave->id,
            'tags' => 'leave',
        ]);

        return $leave->fresh(['segments.type', 'approvalRequest.workflow.steps', 'approvalRequest.history.user']);
    }

    public function approve(LeaveRequest $leave, User $approver, ?string $overrideReason = null): LeaveRequest
    {
        if (! $leave->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be approved.']);
        }

        if ((int) $leave->requester_id === (int) $approver->id) {
            abort(403, 'You cannot approve your own request.');
        }

        $this->checkLeaveBalance($leave, $overrideReason);

        $leave->update([
            'status' => 'approved',
            'approved_by' => $approver->id,
            'approved_at' => now(),
            'current_stage' => 'Approved',
            'current_holder' => null,
        ]);

        $this->balanceService->postLeaveTaken($leave, $approver);
        $this->payrollImpactService->recordForApprovedLeave($leave);
        $this->recordApprovalSideEffects($leave, $approver);

        return $leave->fresh(['segments.type']);
    }

    public function reject(LeaveRequest $leave, string $reason, User $approver): LeaveRequest
    {
        if (! $leave->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be rejected.']);
        }

        $leave->update([
            'status' => 'rejected',
            'approved_by' => $approver->id,
            'rejection_reason' => $reason,
            'current_stage' => 'Rejected',
            'current_holder' => null,
        ]);

        AuditLog::record('leave.rejected', [
            'auditable_type' => LeaveRequest::class,
            'auditable_id' => $leave->id,
            'new_values' => ['reason' => $reason],
            'tags' => 'leave',
        ]);

        $leave->loadMissing('requester');
        if ($leave->requester) {
            $this->notificationService->dispatch($leave->requester, 'leave.rejected', [
                'name' => $leave->requester->name,
                'reference' => $leave->reference_number,
                'leave_type' => ucfirst(str_replace('_', ' ', $leave->leave_type)),
                'start_date' => $leave->start_date,
                'end_date' => $leave->end_date,
                'comment' => $reason,
            ], ['module' => 'leave', 'record_id' => $leave->id, 'url' => '/leave/' . $leave->id]);
        }

        return $leave->fresh();
    }

    public function recommend(LeaveRequest $leave, User $actor, string $action, ?string $comment = null): LeaveRequest
    {
        if (! in_array($leave->status, ['submitted', 'resubmitted', 'pending_next_step'], true)) {
            throw ValidationException::withMessages(['status' => 'Only submitted leave requests can be recommended or returned.']);
        }

        if ((int) $leave->requester_id === (int) $actor->id) {
            abort(403, 'You cannot recommend your own leave request.');
        }

        abort_unless(
            $actor->can('leave.approve') || $actor->can('hr.approve') || $actor->hasAnyRole(['HOD', 'HR Manager', 'HR Administrator', 'Secretary General', 'System Admin']),
            403,
            'You are not authorised to recommend this leave request.'
        );

        $status = match ($action) {
            'recommend' => 'recommended',
            'not_recommend' => 'not_recommended',
            'return' => 'returned',
            default => throw ValidationException::withMessages(['action' => 'Unsupported recommendation action.']),
        };

        if (in_array($status, ['not_recommended', 'returned'], true) && ! $comment) {
            throw ValidationException::withMessages(['comment' => 'A reason is required for this recommendation action.']);
        }

        $leave->update([
            'recommendation_status' => $status,
            'recommended_by' => $actor->id,
            'recommended_at' => now(),
            'recommendation_comments' => $comment,
            'current_stage' => $status === 'returned' ? 'Returned for Correction' : 'Administration/HR Certification',
            'current_holder' => $status === 'returned' ? $leave->requester?->name : 'HR/Admin',
            'status' => $status === 'returned' ? 'returned_for_correction' : $leave->status,
        ]);

        AuditLog::record('leave.recommendation.' . $status, [
            'auditable_type' => LeaveRequest::class,
            'auditable_id' => $leave->id,
            'new_values' => ['status' => $status, 'comment' => $comment],
            'tags' => 'leave',
        ]);

        return $leave->fresh(['requester', 'recommender', 'segments.type']);
    }

    public function certify(LeaveRequest $leave, User $actor, string $action, array $segments = [], ?string $comment = null): LeaveRequest
    {
        if (! in_array($leave->status, ['submitted', 'resubmitted', 'pending_next_step'], true)) {
            throw ValidationException::withMessages(['status' => 'Only submitted leave requests can be certified.']);
        }

        if ((int) $leave->requester_id === (int) $actor->id) {
            abort(403, 'You cannot certify your own leave request.');
        }

        abort_unless(
            $actor->can('leave.approve') || $actor->can('hr.admin') || $actor->hasAnyRole(['HR Manager', 'HR Administrator', 'System Admin']),
            403,
            'You are not authorised to certify this leave request.'
        );

        $status = match ($action) {
            'certify' => 'certified',
            'certify_with_condition' => 'certified_with_condition',
            'return' => 'returned',
            'mark_ineligible' => 'ineligible',
            default => throw ValidationException::withMessages(['action' => 'Unsupported certification action.']),
        };

        if (in_array($status, ['returned', 'ineligible', 'certified_with_condition'], true) && ! $comment) {
            throw ValidationException::withMessages(['comment' => 'A reason is required for this certification action.']);
        }

        $leave->loadMissing(['requester', 'segments']);
        $segmentPayloads = collect($segments)->keyBy(fn ($row) => (int) ($row['id'] ?? $row['segment_id'] ?? 0));

        DB::transaction(function () use ($leave, $actor, $status, $segmentPayloads, $comment) {
            foreach ($leave->segments as $segment) {
                $payload = $segmentPayloads->get($segment->id, []);
                $eligibleDays = array_key_exists('eligible_days', $payload)
                    ? (float) $payload['eligible_days']
                    : (float) $segment->amount_requested;

                $segment->update([
                    'certification_status' => $status,
                    'eligible_days' => $eligibleDays,
                    'document_status' => $payload['document_status'] ?? ($status === 'certified' ? 'complete' : null),
                    'certified_by' => $actor->id,
                    'certified_at' => now(),
                    'certification_comments' => $payload['comments'] ?? $comment,
                    'status' => $status === 'ineligible' ? 'ineligible' : $segment->status,
                ]);
            }

            $leave->update([
                'certification_status' => $status,
                'certified_by' => $actor->id,
                'certified_at' => now(),
                'certification_comments' => $comment,
                'current_stage' => match ($status) {
                    'returned' => 'Returned for Correction',
                    'ineligible' => 'Administration/HR Marked Ineligible',
                    default => 'Head of Institution Authorisation',
                },
                'current_holder' => match ($status) {
                    'returned' => $leave->requester?->name,
                    'ineligible' => 'HR/Admin',
                    default => 'Secretary General / Head of Institution',
                },
                'status' => $status === 'returned' ? 'returned_for_correction' : $leave->status,
            ]);
        });

        AuditLog::record('leave.certification.' . $status, [
            'auditable_type' => LeaveRequest::class,
            'auditable_id' => $leave->id,
            'new_values' => ['status' => $status, 'comment' => $comment],
            'tags' => 'leave',
        ]);

        return $leave->fresh(['requester', 'certifier', 'segments.type']);
    }

    public function validateLeaveBalance(LeaveRequest $leave, ?string $overrideReason = null): void
    {
        $this->checkLeaveBalance($leave, $overrideReason);
    }

    public function onWorkflowApproved(LeaveRequest $leave, User $approver): void
    {
        $leave->update([
            'status' => 'approved',
            'approved_by' => $approver->id,
            'approved_at' => now(),
            'current_stage' => 'Approved',
            'current_holder' => null,
        ]);

        $this->balanceService->postLeaveTaken($leave, $approver);
        $this->payrollImpactService->recordForApprovedLeave($leave);
        $this->recordApprovalSideEffects($leave, $approver);
    }

    public function onWorkflowRejected(LeaveRequest $leave, User $approver, ?string $reason = null): void
    {
        $leave->update([
            'status' => 'rejected',
            'approved_by' => $approver->id,
            'rejection_reason' => $reason,
            'current_stage' => 'Rejected',
            'current_holder' => null,
        ]);

        $leave->loadMissing('requester');
        if ($leave->requester) {
            $this->notificationService->dispatch($leave->requester, 'leave.rejected', [
                'name' => $leave->requester->name,
                'reference' => $leave->reference_number,
                'leave_type' => ucfirst(str_replace('_', ' ', $leave->leave_type)),
                'start_date' => $leave->start_date,
                'end_date' => $leave->end_date,
                'comment' => $reason ?? '',
            ], ['module' => 'leave', 'record_id' => $leave->id, 'url' => '/leave/' . $leave->id]);
        }
    }

    private function checkLeaveBalance(LeaveRequest $leave, ?string $overrideReason = null): void
    {
        $leave->loadMissing(['requester', 'segments']);

        $segments = $leave->segments->isNotEmpty()
            ? $leave->segments
            : collect([new LeaveSegment([
                'leave_type' => $leave->leave_type,
                'amount_requested' => $leave->days_requested,
            ])]);

        foreach ($segments->groupBy('leave_type') as $leaveType => $group) {
            $type = $this->policyService->leaveType($leave->tenant_id, $leaveType);
            if ($type?->allow_negative_balance) {
                continue;
            }

            try {
                $this->balanceService->assertAvailable(
                    $leave->requester,
                    $leaveType,
                    (float) $group->sum('amount_requested'),
                    $leave->id
                );
            } catch (ValidationException $exception) {
                if (! $overrideReason) {
                    throw $exception;
                }

                AuditLog::record('leave.balance_override', [
                    'auditable_type' => LeaveRequest::class,
                    'auditable_id' => $leave->id,
                    'new_values' => [
                        'leave_type' => $leaveType,
                        'days_requested' => (float) $group->sum('amount_requested'),
                        'override_reason' => $overrideReason,
                    ],
                    'tags' => 'leave',
                ]);
            }
        }
    }

    /** @return list<array<string, mixed>> */
    private function normaliseSegmentInputs(array $data): array
    {
        if (! empty($data['segments'])) {
            return $data['segments'];
        }

        return [[
            'leave_type' => $data['leave_type'],
            'start_date' => $data['start_date'],
            'end_date' => $data['end_date'],
            'day_part' => $data['day_part'] ?? 'full',
            'source_type' => $data['source_type'] ?? null,
            'source_id' => $data['source_id'] ?? null,
            'document_status' => $data['document_status'] ?? null,
            'comments' => $data['comments'] ?? null,
        ]];
    }

    /** @param list<array<string, mixed>> $segments */
    private function assertSegmentsDoNotOverlap(array $segments): void
    {
        $ordered = collect($segments)->sortBy('start_date')->values();
        for ($i = 1; $i < $ordered->count(); $i++) {
            $previousEnd = Carbon::parse($ordered[$i - 1]['end_date']);
            $currentStart = Carbon::parse($ordered[$i]['start_date']);
            if ($currentStart->lte($previousEnd)) {
                throw ValidationException::withMessages([
                    'segments' => ['Leave segments may not overlap.'],
                ]);
            }
        }
    }

    private function validateSegmentsForSubmission(LeaveRequest $leave): void
    {
        $hrFile = HrPersonalFile::query()
            ->where('tenant_id', $leave->tenant_id)
            ->where('employee_id', $leave->requester_id)
            ->first();

        foreach ($leave->segments as $segment) {
            $type = $this->policyService->leaveType($leave->tenant_id, $segment->leave_type);
            $this->assertSegmentPolicyCompliance($leave, $segment, $type, $hrFile);

            if ($segment->leave_type === 'lil' && $segment->source_type === ToilCredit::class && $segment->source_id) {
                $credit = ToilCredit::where('tenant_id', $leave->tenant_id)
                    ->where('user_id', $leave->requester_id)
                    ->findOrFail($segment->source_id);
                $this->toilCreditService->assertCreditUsable($credit, (float) $segment->amount_requested);
            }
        }
    }

    private function assertSegmentPolicyCompliance(LeaveRequest $leave, LeaveSegment $segment, ?LeaveType $type, ?HrPersonalFile $hrFile): void
    {
        if ($type && $segment->day_part !== 'full' && ! $type->allow_half_day) {
            throw ValidationException::withMessages([
                'day_part' => ucfirst($segment->leave_type) . ' leave does not allow half-day requests under the current policy.',
            ]);
        }

        if ($hrFile?->contract_expiry_date && Carbon::parse($segment->end_date)->gt($hrFile->contract_expiry_date)) {
            throw ValidationException::withMessages([
                'contract_end_date' => 'This leave request extends beyond the employee contract end date.',
            ]);
        }

        match ($segment->leave_type) {
            'annual' => $this->validateAnnualSegment($leave, $segment, $hrFile),
            'sick' => $this->validateSickSegment($leave, $segment, $type, $hrFile),
            'study' => $this->validateCycleLimit($leave, $segment, $type, 'study', 15, 'Study leave'),
            'compassionate' => $this->validateCycleLimit($leave, $segment, $type, 'compassionate', 5, 'Compassionate leave'),
            'unpaid' => $this->validateUnpaidSegment($segment, $type),
            'maternity' => $this->validateMaternitySegment($leave, $segment, $type, $hrFile),
            'paternity' => $this->validatePaternitySegment($leave, $segment, $type, $hrFile),
            'home' => $this->validateHomeLeaveSegment($leave, $segment, $hrFile),
            default => null,
        };
    }

    private function validateAnnualSegment(LeaveRequest $leave, LeaveSegment $segment, ?HrPersonalFile $hrFile): void
    {
        if ($hrFile && ! in_array($hrFile->probation_status, ['confirmed', 'not_applicable'], true) && ! $hrFile->confirmation_date) {
            throw ValidationException::withMessages([
                'confirmation_status' => 'Annual leave is available only after the employee is confirmed in post.',
            ]);
        }

        $this->balanceService->assertAvailable($leave->requester, 'annual', (float) $segment->amount_requested, $leave->id);
    }

    private function validateSickSegment(LeaveRequest $leave, LeaveSegment $segment, ?LeaveType $type, ?HrPersonalFile $hrFile): void
    {
        $threshold = (int) ($type?->medical_certificate_after_days ?? ($type?->rules['medical_certificate_after_days'] ?? 2));
        $documentStatus = strtolower((string) ($segment->document_status ?? ''));

        if ((float) $segment->working_days > $threshold && ! in_array($documentStatus, ['complete', 'provided', 'uploaded', 'restricted'], true)) {
            throw ValidationException::withMessages([
                'medical_certificate' => 'A medical certificate is required for this sick-leave period.',
            ]);
        }

        $this->sickLeaveService->assertWithinCycleEntitlement($leave, $segment, $type, $hrFile);
        $this->sickLeaveService->applyPayTreatment($leave, $segment, $hrFile);
    }

    private function validateCycleLimit(LeaveRequest $leave, LeaveSegment $segment, ?LeaveType $type, string $leaveType, int $defaultLimit, string $label): void
    {
        $limit = (float) ($type?->rules['annual_limit_days'] ?? $type?->annual_entitlement ?? $defaultLimit);
        $year = Carbon::parse($segment->start_date)->year;
        $used = (float) LeaveSegment::query()
            ->where('leave_type', $leaveType)
            ->whereHas('leaveRequest', function ($query) use ($leave, $year) {
                $query->where('tenant_id', $leave->tenant_id)
                    ->where('requester_id', $leave->requester_id)
                    ->where('id', '!=', $leave->id)
                    ->whereIn('status', ['submitted', 'pending_next_step', 'approved'])
                    ->whereYear('start_date', $year);
            })
            ->sum('amount_requested');

        if ($used + (float) $segment->amount_requested > $limit) {
            throw ValidationException::withMessages([
                $leaveType => "{$label} exceeds the remaining entitlement for the current year.",
            ]);
        }
    }

    private function validateUnpaidSegment(LeaveSegment $segment, ?LeaveType $type): void
    {
        $limitDays = (int) ($type?->rules['max_consecutive_calendar_days'] ?? 92);

        if ((float) $segment->calendar_days > $limitDays) {
            throw ValidationException::withMessages([
                'unpaid' => 'Leave without pay may not exceed three consecutive months in one year.',
            ]);
        }
    }

    private function validateMaternitySegment(LeaveRequest $leave, LeaveSegment $segment, ?LeaveType $type, ?HrPersonalFile $hrFile): void
    {
        $maxCalendarDays = (int) ($type?->rules['max_calendar_days'] ?? 92);
        if ((float) $segment->calendar_days > $maxCalendarDays) {
            throw ValidationException::withMessages([
                'maternity' => 'Maternity leave may not exceed three months under the current policy.',
            ]);
        }

        $serviceDate = $this->serviceStartDate($leave, $hrFile);
        $minimumMonths = (int) ($type?->rules['minimum_service_months'] ?? 6);
        if ($serviceDate && $serviceDate->copy()->addMonths($minimumMonths)->gt(Carbon::parse($segment->start_date))) {
            throw ValidationException::withMessages([
                'maternity' => 'Maternity leave requires at least six months unbroken qualifying service.',
            ]);
        }
    }

    private function validatePaternitySegment(LeaveRequest $leave, LeaveSegment $segment, ?LeaveType $type, ?HrPersonalFile $hrFile): void
    {
        $maxDays = (float) ($type?->rules['max_working_days'] ?? $type?->annual_entitlement ?? 5);
        if ((float) $segment->amount_requested > $maxDays) {
            throw ValidationException::withMessages([
                'paternity' => 'Paternity leave may not exceed the configured maximum working days.',
            ]);
        }

        $serviceDate = $this->serviceStartDate($leave, $hrFile);
        $minimumMonths = (int) ($type?->rules['minimum_service_months'] ?? 12);
        if ($serviceDate && $serviceDate->copy()->addMonths($minimumMonths)->gt(Carbon::parse($segment->start_date))) {
            throw ValidationException::withMessages([
                'paternity' => 'Paternity leave requires at least twelve months unbroken qualifying service.',
            ]);
        }

        $intervalMonths = (int) ($type?->rules['minimum_interval_months'] ?? 24);
        $recent = LeaveRequest::query()
            ->where('tenant_id', $leave->tenant_id)
            ->where('requester_id', $leave->requester_id)
            ->where('id', '!=', $leave->id)
            ->where('leave_type', 'paternity')
            ->whereIn('status', ['submitted', 'pending_next_step', 'approved'])
            ->whereDate('start_date', '>=', Carbon::parse($segment->start_date)->copy()->subMonths($intervalMonths)->toDateString())
            ->exists();

        if ($recent) {
            throw ValidationException::withMessages([
                'paternity' => 'Paternity leave is available only once in the configured interval.',
            ]);
        }
    }

    private function validateHomeLeaveSegment(LeaveRequest $leave, LeaveSegment $segment, ?HrPersonalFile $hrFile): void
    {
        $serviceDate = $this->serviceStartDate($leave, $hrFile);
        if ($serviceDate && $serviceDate->copy()->addYears(2)->gt(Carbon::parse($segment->start_date))) {
            throw ValidationException::withMessages([
                'home' => 'Home leave is available only after the required two years of qualifying service.',
            ]);
        }
    }

    private function serviceStartDate(LeaveRequest $leave, ?HrPersonalFile $hrFile): ?Carbon
    {
        $date = $hrFile?->appointment_date ?? $leave->requester?->join_date;

        return $date ? Carbon::parse($date) : null;
    }

    private function prepareToilSource(User $user, array $segment, float $amount): void
    {
        if (($segment['source_type'] ?? null) === TravelToilCandidate::class && ! empty($segment['source_id'])) {
            $candidate = TravelToilCandidate::where('tenant_id', $user->tenant_id)
                ->where('user_id', $user->id)
                ->findOrFail($segment['source_id']);
            $credit = $this->toilCreditService->ensureCreditFromTravelCandidate($candidate);
            $this->toilCreditService->assertCreditUsable($credit, $amount);
        }

        if (($segment['source_type'] ?? null) === ToilCredit::class && ! empty($segment['source_id'])) {
            $credit = ToilCredit::where('tenant_id', $user->tenant_id)
                ->where('user_id', $user->id)
                ->findOrFail($segment['source_id']);
            $this->toilCreditService->assertCreditUsable($credit, $amount);
        }
    }

    private function attachLegacyLilLinkings(LeaveRequest $leave, array $linkings, User $user): void
    {
        $totalLinked = 0.0;
        foreach ($linkings as $linking) {
            $sourceId = $linking['source_id'] ?? null;
            $linkingData = array_diff_key($linking, ['source_id' => 1]);
            $leave->lilLinkings()->create($linkingData);
            $totalLinked += (float) $linking['hours'];

            if ($sourceId && str_starts_with($sourceId, 'overtime-')) {
                $accrualId = (int) substr($sourceId, strlen('overtime-'));
                $accrual = OvertimeAccrual::where('id', $accrualId)->where('user_id', $user->id)->first();
                if ($accrual) {
                    $expired = $accrual->expires_at
                        ? $accrual->expires_at->lt(now()->startOfDay())
                        : $accrual->accrual_date->diffInDays(now()) > 30;
                    if ($expired) {
                        throw ValidationException::withMessages([
                            'lil' => ["Overtime accrual {$accrual->code} has lapsed. Secretary General extension is required before use."],
                        ]);
                    }
                    $accrual->update(['is_linked' => true]);
                }
            }
        }
        $leave->update(['lil_hours_linked' => $totalLinked]);
    }

    private function recordApprovalSideEffects(LeaveRequest $leave, User $approver): void
    {
        AuditLog::record('leave.approved', [
            'auditable_type' => LeaveRequest::class,
            'auditable_id' => $leave->id,
            'tags' => 'leave',
        ]);

        $leave->loadMissing('requester');
        if ($leave->requester) {
            $this->notificationService->dispatch($leave->requester, 'leave.approved', [
                'name' => $leave->requester->name,
                'leave_type' => ucfirst(str_replace('_', ' ', $leave->leave_type)),
                'start_date' => $leave->start_date,
                'end_date' => $leave->end_date,
            ], ['module' => 'leave', 'record_id' => $leave->id, 'url' => '/leave/' . $leave->id]);
        }

        $typeLabel = ucfirst(str_replace('_', ' ', $leave->leave_type)) . ' Leave';
        WorkplanEvent::updateOrCreate(
            ['linked_module' => 'leave', 'linked_id' => $leave->id],
            [
                'tenant_id' => $leave->tenant_id,
                'created_by' => $approver->id,
                'title' => ($leave->requester?->name ?? 'Staff') . ' - ' . $typeLabel,
                'type' => 'leave',
                'date' => $leave->start_date,
                'end_date' => $leave->end_date,
                'responsible' => $leave->requester?->name,
                'description' => $leave->reference_number . ' - ' . $leave->days_requested . ' days',
            ]
        );
    }

    public function getLilAccrualsFromApprovedTravel(User $user): array
    {
        $credited = TravelToilCandidate::with('overtimeAccrual')
            ->where('user_id', $user->id)
            ->where('status', TravelToilCandidate::STATUS_CREDITED)
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>=', now()->toDateString());
            })
            ->orderByDesc('candidate_date')
            ->get();

        $byDate = [];
        foreach ($credited as $candidate) {
            if ($candidate->overtimeAccrual?->is_linked) {
                continue;
            }

            $credit = $this->toilCreditService->ensureCreditFromTravelCandidate($candidate);
            if ($credit->remaining_balance <= 0) {
                continue;
            }

            $dateStr = $candidate->candidate_date->format('Y-m-d');
            $byDate[$dateStr] = [
                'id' => 'toil-credit-' . $credit->id,
                'source_type' => ToilCredit::class,
                'source_id' => $credit->id,
                'code' => $credit->credit_reference,
                'description' => $candidate->overtimeAccrual?->description ?? ('Travel TOIL ' . $dateStr),
                'hours' => (float) $candidate->hours,
                'days' => (float) $credit->remaining_balance,
                'date' => $dateStr,
                'approved_by' => $candidate->overtimeAccrual?->approved_by_name,
                'is_verified' => true,
                'expires_at' => $credit->expiry_date?->format('Y-m-d'),
            ];
        }

        return array_values($byDate);
    }

    public function form005Pdf(LeaveRequest $leave)
    {
        $leave->load([
            'requester.department',
            'requester.position',
            'approver',
            'recommender',
            'certifier',
            'policyVersion',
            'segments.type',
            'approvalRequest.history.user',
            'approvalRequest.workflow.steps',
        ]);

        return \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.leave_form_005', [
            'leave' => $leave,
            'generatedAt' => now(),
        ]);
    }
}
