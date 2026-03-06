<?php
namespace App\Modules\Leave\Services;

use App\Models\AuditLog;
use App\Models\LeaveRequest;
use App\Models\User;
use App\Models\WorkplanEvent;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LeaveService
{
    public function __construct(protected \App\Services\WorkflowService $workflowService) {}

    public function list(array $filters, User $user): LengthAwarePaginator
    {
        $query = LeaveRequest::with(['requester'])
            ->orderByDesc('created_at');

        if ($user->hasRole('staff')) {
            $query->where('requester_id', $user->id);
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['leave_type'])) {
            $query->where('leave_type', $filters['leave_type']);
        }

        return $query->paginate($filters['per_page'] ?? 20);
    }

    public function create(array $data, User $user): LeaveRequest
    {
        $startDate = \Carbon\Carbon::parse($data['start_date']);
        $endDate   = \Carbon\Carbon::parse($data['end_date']);
        $daysRequested = $startDate->diffInWeekdays($endDate) + 1;

        $hasLil = ($data['leave_type'] === 'lil');

        $leave = LeaveRequest::create([
            'tenant_id'          => $user->tenant_id,
            'requester_id'       => $user->id,
            'reference_number'   => 'LVE-' . strtoupper(Str::random(8)),
            'leave_type'         => $data['leave_type'],
            'start_date'         => $data['start_date'],
            'end_date'           => $data['end_date'],
            'days_requested'     => $daysRequested,
            'reason'             => $data['reason'] ?? null,
            'status'             => 'draft',
            'has_lil_linking'    => $hasLil,
            'lil_hours_required' => $hasLil ? $daysRequested * 8 : null,
        ]);

        if ($hasLil && !empty($data['lil_linkings'])) {
            $totalLinked = 0;
            foreach ($data['lil_linkings'] as $linking) {
                $leave->lilLinkings()->create($linking);
                $totalLinked += $linking['hours'];
            }
            $leave->update(['lil_hours_linked' => $totalLinked]);
        }

        AuditLog::record('leave.created', [
            'auditable_type' => LeaveRequest::class,
            'auditable_id'   => $leave->id,
            'new_values'     => ['reference' => $leave->reference_number, 'type' => $leave->leave_type],
            'tags'           => 'leave',
        ]);

        return $leave->load(['requester', 'lilLinkings']);
    }

    public function update(LeaveRequest $leave, array $data, User $user): LeaveRequest
    {
        if (!$leave->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft requests can be edited.']);
        }

        $leave->update(array_filter([
            'leave_type'  => $data['leave_type'] ?? null,
            'start_date'  => $data['start_date'] ?? null,
            'end_date'    => $data['end_date'] ?? null,
            'reason'      => $data['reason'] ?? null,
        ], fn($v) => $v !== null));

        AuditLog::record('leave.updated', [
            'auditable_type' => LeaveRequest::class,
            'auditable_id'   => $leave->id,
            'tags'           => 'leave',
        ]);

        return $leave->fresh(['requester', 'lilLinkings']);
    }

    public function submit(LeaveRequest $leave, User $user): LeaveRequest
    {
        if (!$leave->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft requests can be submitted.']);
        }

        if ($leave->has_lil_linking && $leave->lil_hours_linked < $leave->lil_hours_required) {
            throw ValidationException::withMessages(['lil' => 'You must link sufficient LIL hours before submitting.']);
        }

        $leave->update(['status' => 'submitted', 'submitted_at' => now()]);

        // Initiate workflow
        $this->workflowService->initiate($leave, 'leave', $user);

        AuditLog::record('leave.submitted', [
            'auditable_type' => LeaveRequest::class,
            'auditable_id'   => $leave->id,
            'tags'           => 'leave',
        ]);

        return $leave->fresh();
    }

    public function approve(LeaveRequest $leave, User $approver): LeaveRequest
    {
        if (!$leave->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be approved.']);
        }

        $leave->update([
            'status'      => 'approved',
            'approved_by' => $approver->id,
            'approved_at' => now(),
        ]);

        AuditLog::record('leave.approved', [
            'auditable_type' => LeaveRequest::class,
            'auditable_id'   => $leave->id,
            'tags'           => 'leave',
        ]);

        // Add approved leave to the workplan calendar
        $leave->loadMissing('requester');
        $typeLabel = ucfirst(str_replace('_', ' ', $leave->leave_type)) . ' Leave';
        WorkplanEvent::updateOrCreate(
            ['linked_module' => 'leave', 'linked_id' => $leave->id],
            [
                'tenant_id'   => $leave->tenant_id,
                'created_by'  => $approver->id,
                'title'       => ($leave->requester?->name ?? 'Staff') . ' — ' . $typeLabel,
                'type'        => 'leave',
                'date'        => $leave->start_date,
                'end_date'    => $leave->end_date,
                'responsible' => $leave->requester?->name,
                'description' => $leave->reference_number . ' · ' . $leave->days_requested . ' days',
            ]
        );

        return $leave->fresh();
    }

    public function reject(LeaveRequest $leave, string $reason, User $approver): LeaveRequest
    {
        if (!$leave->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be rejected.']);
        }

        $leave->update([
            'status'           => 'rejected',
            'approved_by'      => $approver->id,
            'rejection_reason' => $reason,
        ]);

        AuditLog::record('leave.rejected', [
            'auditable_type' => LeaveRequest::class,
            'auditable_id'   => $leave->id,
            'new_values'     => ['reason' => $reason],
            'tags'           => 'leave',
        ]);

        return $leave->fresh();
    }

    /**
     * Called by WorkflowService when the workflow is fully approved.
     */
    public function onWorkflowApproved(LeaveRequest $leave, User $approver): void
    {
        $leave->update([
            'status'      => 'approved',
            'approved_by' => $approver->id,
            'approved_at' => now(),
        ]);

        // Add approved leave to the workplan calendar
        $leave->loadMissing('requester');
        $typeLabel = ucfirst(str_replace('_', ' ', $leave->leave_type)) . ' Leave';
        WorkplanEvent::updateOrCreate(
            ['linked_module' => 'leave', 'linked_id' => $leave->id],
            [
                'tenant_id'   => $leave->tenant_id,
                'created_by'  => $approver->id,
                'title'       => ($leave->requester?->name ?? 'Staff') . ' — ' . $typeLabel,
                'type'        => 'leave',
                'date'        => $leave->start_date,
                'end_date'    => $leave->end_date,
                'responsible' => $leave->requester?->name,
                'description' => $leave->reference_number . ' · ' . $leave->days_requested . ' days',
            ]
        );
    }

    /**
     * Called by WorkflowService when the workflow is rejected.
     */
    public function onWorkflowRejected(LeaveRequest $leave, User $approver, ?string $reason = null): void
    {
        $leave->update([
            'status'           => 'rejected',
            'approved_by'      => $approver->id,
            'rejection_reason' => $reason,
        ]);
    }
}
