<?php

namespace App\Modules\Assignments\Services;

use App\Models\Assignment;
use App\Models\AssignmentUpdate;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AssignmentService
{
    public function __construct(
        private readonly NotificationService $notificationService
    ) {}
    // ── Listing ────────────────────────────────────────────────────────────────

    public function list(array $filters, User $user): LengthAwarePaginator
    {
        $query = Assignment::with(['creator', 'assignee', 'department'])
            ->orderByDesc('created_at');

        // Role-based scoping
        $isManager = $user->isSystemAdmin() || $user->isSecretaryGeneral() || $user->hasAnyRole(['HR Manager', 'Finance Controller']);
        if (!$isManager) {
            // Staff see assignments they created or are assigned to
            $query->where(function ($q) use ($user) {
                $q->where('created_by', $user->id)
                  ->orWhere('assigned_to', $user->id);
            });
        }

        if (!empty($filters['status'])) {
            $statuses = array_filter(array_map('trim', explode(',', $filters['status'])));
            if (count($statuses) === 1) {
                $query->where('status', $statuses[0]);
            } elseif (count($statuses) > 1) {
                $query->whereIn('status', $statuses);
            }
        }

        if (!empty($filters['priority'])) {
            $query->where('priority', $filters['priority']);
        }

        if (!empty($filters['assigned_to'])) {
            $query->where('assigned_to', $filters['assigned_to']);
        }

        if (!empty($filters['department_id'])) {
            $query->where('department_id', $filters['department_id']);
        }

        if (!empty($filters['overdue']) && $filters['overdue'] === 'true') {
            $query->whereNotIn('status', ['closed', 'cancelled'])
                  ->whereDate('due_date', '<', now());
        }

        if (!empty($filters['search'])) {
            $query->where(function ($q) use ($filters) {
                $q->where('reference_number', 'ilike', "%{$filters['search']}%")
                  ->orWhere('title', 'ilike', "%{$filters['search']}%")
                  ->orWhere('description', 'ilike', "%{$filters['search']}%");
            });
        }

        return $query->paginate($filters['per_page'] ?? 20);
    }

    public function stats(User $user): array
    {
        $base = Assignment::query();

        $isManager = $user->isSystemAdmin() || $user->isSecretaryGeneral() || $user->hasAnyRole(['HR Manager', 'Finance Controller']);
        if (!$isManager) {
            $base->where(function ($q) use ($user) {
                $q->where('created_by', $user->id)->orWhere('assigned_to', $user->id);
            });
        }

        $total       = (clone $base)->count();
        $pending     = (clone $base)->whereIn('status', ['draft', 'awaiting_acceptance'])->count();
        $in_progress = (clone $base)->whereIn('status', ['active', 'at_risk', 'blocked', 'delayed', 'accepted'])->count();
        $active      = $in_progress;
        $overdue     = (clone $base)->whereNotIn('status', ['closed', 'cancelled'])->whereDate('due_date', '<', now())->count();
        $due_soon    = (clone $base)->whereNotIn('status', ['closed', 'cancelled', 'completed'])->whereBetween('due_date', [now(), now()->addDays(7)])->count();
        $awaiting    = (clone $base)->where('status', 'awaiting_acceptance')->count();
        $blocked     = (clone $base)->where('status', 'blocked')->count();
        $completed   = (clone $base)->where('status', 'closed')->count();
        $my_pending  = Assignment::where('assigned_to', $user->id)
            ->whereIn('status', ['issued', 'awaiting_acceptance'])->count();

        // By priority
        $by_priority = (clone $base)
            ->whereNotIn('status', ['closed', 'cancelled'])
            ->selectRaw('priority, count(*) as count')
            ->groupBy('priority')
            ->pluck('count', 'priority')
            ->toArray();

        // By status
        $by_status = (clone $base)
            ->selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        return compact('total', 'pending', 'in_progress', 'active', 'overdue', 'due_soon', 'awaiting', 'blocked', 'completed', 'my_pending', 'by_priority', 'by_status');
    }

    // ── CRUD ───────────────────────────────────────────────────────────────────

    public function create(array $data, User $user): Assignment
    {
        $assignment = Assignment::create([
            'tenant_id'          => $user->tenant_id,
            'reference_number'   => 'ASN-' . strtoupper(Str::random(7)),
            'title'              => $data['title'],
            'description'        => $data['description'],
            'objective'          => $data['objective'] ?? null,
            'expected_output'    => $data['expected_output'] ?? null,
            'type'               => $data['type'] ?? 'individual',
            'priority'           => $data['priority'] ?? 'medium',
            'status'             => 'draft',
            'created_by'         => $user->id,
            'assigned_to'        => $data['assigned_to'] ?? null,
            'department_id'      => $data['department_id'] ?? null,
            'due_date'           => $data['due_date'],
            'start_date'         => $data['start_date'] ?? null,
            'checkin_frequency'  => $data['checkin_frequency'] ?? null,
            'linked_programme_id' => $data['linked_programme_id'] ?? null,
            'linked_event_id'    => $data['linked_event_id'] ?? null,
            'is_confidential'    => $data['is_confidential'] ?? false,
        ]);

        AuditLog::record('assignment.created', [
            'auditable_type' => Assignment::class,
            'auditable_id'   => $assignment->id,
            'new_values'     => ['reference' => $assignment->reference_number, 'title' => $assignment->title],
            'tags'           => 'assignments',
        ]);

        return $assignment->load(['creator', 'assignee', 'department']);
    }

    public function update(Assignment $assignment, array $data, User $user): Assignment
    {
        if (!$assignment->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft assignments can be edited.']);
        }

        $assignment->update(array_filter($data, fn ($v) => $v !== null));

        AuditLog::record('assignment.updated', [
            'auditable_type' => Assignment::class,
            'auditable_id'   => $assignment->id,
            'new_values'     => $data,
            'tags'           => 'assignments',
        ]);

        return $assignment->fresh(['creator', 'assignee', 'department']);
    }

    public function delete(Assignment $assignment, User $user): void
    {
        if (!$assignment->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft assignments can be deleted.']);
        }

        AuditLog::record('assignment.deleted', [
            'auditable_type' => Assignment::class,
            'auditable_id'   => $assignment->id,
            'new_values'     => ['reference' => $assignment->reference_number],
            'tags'           => 'assignments',
        ]);

        $assignment->delete();
    }

    // ── Workflow ───────────────────────────────────────────────────────────────

    public function issue(Assignment $assignment, User $user): Assignment
    {
        if (!$assignment->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft assignments can be issued.']);
        }

        $assignment->update([
            'status'    => 'awaiting_acceptance',
            'issued_at' => now(),
        ]);

        $this->logUpdate($assignment, $user, 'system', 'Assignment issued and sent to assignee for acceptance.');

        // Notify the assignee
        $assignment->loadMissing('assignee');
        if ($assignment->assignee) {
            $this->notificationService->dispatch($assignment->assignee, 'assignment.issued', [
                'name'        => $assignment->assignee->name,
                'task_title'  => $assignment->title,
                'due_date'    => $assignment->due_date,
                'description' => $assignment->description ?? '',
                'issuer'      => $user->name,
                'reference'   => $assignment->reference_number,
            ], ['module' => 'assignments', 'record_id' => $assignment->id, 'url' => '/assignments/' . $assignment->id]);
        }

        return $assignment->fresh(['creator', 'assignee', 'department', 'updates.submitter']);
    }

    public function accept(Assignment $assignment, array $data, User $user): Assignment
    {
        if (!in_array($assignment->status, ['issued', 'awaiting_acceptance'])) {
            throw ValidationException::withMessages(['status' => 'Assignment is not awaiting acceptance.']);
        }

        $decision = $data['decision'] ?? 'accepted';

        $assignment->update([
            'status'              => $decision === 'accepted' ? 'accepted' : 'awaiting_acceptance',
            'acceptance_decision' => $decision,
            'acceptance_notes'    => $data['notes'] ?? null,
            'proposed_deadline'   => $data['proposed_deadline'] ?? null,
            'accepted_at'         => $decision === 'accepted' ? now() : null,
        ]);

        $noteText = match ($decision) {
            'accepted'               => 'Assignment accepted.',
            'clarification_requested' => 'Clarification requested: ' . ($data['notes'] ?? ''),
            'deadline_proposed'       => 'New deadline proposed: ' . ($data['proposed_deadline'] ?? ''),
            'rejected'               => 'Assignment declined: ' . ($data['notes'] ?? ''),
            default                  => 'Acceptance response submitted.',
        };

        $this->logUpdate($assignment, $user, 'update', $noteText);

        // Notify the creator of the acceptance decision
        $assignment->loadMissing('creator');
        if ($assignment->creator && (int) $assignment->creator->id !== (int) $user->id) {
            $this->notificationService->dispatch($assignment->creator, 'assignment.accepted', [
                'name'       => $assignment->creator->name,
                'task_title' => $assignment->title,
                'reference'  => $assignment->reference_number,
                'assignee'   => $user->name,
                'decision'   => $decision,
                'notes'      => $data['notes'] ?? '',
            ], ['module' => 'assignments', 'record_id' => $assignment->id, 'url' => '/assignments/' . $assignment->id]);
        }

        return $assignment->fresh(['creator', 'assignee', 'department', 'updates.submitter']);
    }

    public function start(Assignment $assignment, User $user): Assignment
    {
        if (!in_array($assignment->status, ['accepted', 'issued'])) {
            throw ValidationException::withMessages(['status' => 'Assignment must be accepted before starting.']);
        }

        $assignment->update(['status' => 'active']);
        $this->logUpdate($assignment, $user, 'system', 'Assignment marked as active / in progress.');

        return $assignment->fresh(['creator', 'assignee', 'department', 'updates.submitter']);
    }

    public function addUpdate(Assignment $assignment, array $data, User $user): AssignmentUpdate
    {
        if (!in_array($assignment->status, ['active', 'at_risk', 'blocked', 'delayed', 'accepted'])) {
            throw ValidationException::withMessages(['status' => 'Cannot add updates to this assignment in its current state.']);
        }

        // Derive new status
        $newStatus = $assignment->status;
        if (!empty($data['blocker_type'])) {
            $newStatus = 'blocked';
        } elseif (!empty($data['progress_percent'])) {
            $pct = (int) $data['progress_percent'];
            if ($pct >= 100) {
                $newStatus = 'active'; // will require explicit complete action
            } else {
                $daysLeft = now()->diffInDays($assignment->due_date, false);
                $newStatus = ($daysLeft < 0) ? 'delayed' : (($daysLeft <= 3 && $pct < 70) ? 'at_risk' : 'active');
            }
        }

        $update = AssignmentUpdate::create([
            'tenant_id'       => $user->tenant_id,
            'assignment_id'   => $assignment->id,
            'submitted_by'    => $user->id,
            'type'            => $data['type'] ?? 'update',
            'progress_percent' => $data['progress_percent'] ?? null,
            'notes'           => $data['notes'],
            'blocker_type'    => $data['blocker_type'] ?? null,
            'blocker_details' => $data['blocker_details'] ?? null,
        ]);

        $assignment->update([
            'status'          => $newStatus,
            'progress_percent' => $data['progress_percent'] ?? $assignment->progress_percent,
            'blocker_type'    => $data['blocker_type'] ?? null,
            'blocker_details' => $data['blocker_details'] ?? null,
        ]);

        return $update->load('submitter');
    }

    public function complete(Assignment $assignment, array $data, User $user): Assignment
    {
        if (!$assignment->isActive()) {
            throw ValidationException::withMessages(['status' => 'Only active assignments can be submitted for closure.']);
        }

        $assignment->update([
            'status'          => 'completed',
            'progress_percent' => 100,
            'closure_notes'   => $data['notes'] ?? null,
        ]);

        $this->logUpdate($assignment, $user, 'closure_request', 'Assignment submitted for closure. ' . ($data['notes'] ?? ''));

        // Notify the creator that the assignee has completed the assignment
        $assignment->loadMissing('creator');
        if ($assignment->creator && (int) $assignment->creator->id !== (int) $user->id) {
            $this->notificationService->dispatch($assignment->creator, 'assignment.completed', [
                'name'       => $assignment->creator->name,
                'task_title' => $assignment->title,
                'reference'  => $assignment->reference_number,
                'assignee'   => $user->name,
                'notes'      => $data['notes'] ?? '',
            ], ['module' => 'assignments', 'record_id' => $assignment->id, 'url' => '/assignments/' . $assignment->id]);
        }

        return $assignment->fresh(['creator', 'assignee', 'department', 'updates.submitter']);
    }

    public function close(Assignment $assignment, array $data, User $user): Assignment
    {
        if ($assignment->status !== 'completed') {
            throw ValidationException::withMessages(['status' => 'Only completed assignments can be closed.']);
        }

        $assignment->update([
            'status'            => 'closed',
            'closed_at'         => now(),
            'closure_notes'     => $data['notes'] ?? $assignment->closure_notes,
            'completion_rating' => $data['rating'] ?? null,
            'has_performance_note' => !empty($data['rating']),
        ]);

        $this->logUpdate($assignment, $user, 'system', 'Assignment closed by supervisor.' . (!empty($data['notes']) ? ' Notes: ' . $data['notes'] : ''));

        return $assignment->fresh(['creator', 'assignee', 'department', 'updates.submitter']);
    }

    public function returnAssignment(Assignment $assignment, array $data, User $user): Assignment
    {
        if ($assignment->status !== 'completed') {
            throw ValidationException::withMessages(['status' => 'Only completed assignments can be returned.']);
        }

        $assignment->update([
            'status'          => 'returned',
            'progress_percent' => $assignment->progress_percent < 100 ? $assignment->progress_percent : 90,
        ]);

        $reason = $data['reason'] ?? 'Returned by supervisor for further work.';
        $this->logUpdate($assignment, $user, 'feedback', 'Assignment returned: ' . $reason);

        // Notify the assignee that the assignment was returned
        $assignment->loadMissing('assignee');
        if ($assignment->assignee) {
            $this->notificationService->dispatch($assignment->assignee, 'assignment.returned', [
                'name'       => $assignment->assignee->name,
                'task_title' => $assignment->title,
                'reference'  => $assignment->reference_number,
                'reason'     => $reason,
                'issuer'     => $user->name,
            ], ['module' => 'assignments', 'record_id' => $assignment->id, 'url' => '/assignments/' . $assignment->id]);
        }

        return $assignment->fresh(['creator', 'assignee', 'department', 'updates.submitter']);
    }

    public function cancel(Assignment $assignment, array $data, User $user): Assignment
    {
        if (in_array($assignment->status, ['closed', 'cancelled'])) {
            throw ValidationException::withMessages(['status' => 'Assignment is already ' . $assignment->status . '.']);
        }

        $assignment->update([
            'status'           => 'cancelled',
            'rejection_reason' => $data['reason'] ?? null,
        ]);

        $this->logUpdate($assignment, $user, 'system', 'Assignment cancelled. ' . ($data['reason'] ?? ''));

        return $assignment->fresh(['creator', 'assignee', 'department', 'updates.submitter']);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private function logUpdate(Assignment $assignment, User $user, string $type, string $notes): AssignmentUpdate
    {
        return AssignmentUpdate::create([
            'tenant_id'     => $user->tenant_id,
            'assignment_id' => $assignment->id,
            'submitted_by'  => $user->id,
            'type'          => $type,
            'notes'         => $notes,
        ]);
    }
}
