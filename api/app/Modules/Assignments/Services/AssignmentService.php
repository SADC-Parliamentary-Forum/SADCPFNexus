<?php

namespace App\Modules\Assignments\Services;

use App\Models\Assignment;
use App\Models\AssignmentChecklistItem;
use App\Models\AssignmentEvent;
use App\Models\AssignmentParticipant;
use App\Models\AssignmentReminder;
use App\Models\AssignmentReview;
use App\Models\AssignmentUpdate;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
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
        $query = Assignment::with(['creator', 'assignee', 'department', 'reviewer', 'blockerOwner', 'participants.user'])
            ->orderByDesc('created_at');

        if (! empty($filters['templates_only']) && $filters['templates_only'] === 'true') {
            $query->where('is_template', true);
        } else {
            $query->where('is_template', false);
        }

        $this->applyVisibilityScope($query, $user, $filters['scope'] ?? null);

        if (! empty($filters['status'])) {
            $statuses = array_filter(array_map('trim', explode(',', (string) $filters['status'])));
            $query->whereIn('status', $statuses);
        }

        if (! empty($filters['priority'])) {
            $query->where('priority', $filters['priority']);
        }

        if (! empty($filters['assigned_to'])) {
            $query->where('assigned_to', $filters['assigned_to']);
        }

        if (! empty($filters['created_by'])) {
            $query->where('created_by', $filters['created_by']);
        }

        if (! empty($filters['department_id'])) {
            $query->where('department_id', $filters['department_id']);
        }

        if (! empty($filters['source_type'])) {
            $query->where('source_type', $filters['source_type']);
        }

        if (! empty($filters['review_status'])) {
            $query->where('review_status', $filters['review_status']);
        }

        if (! empty($filters['unassigned']) && $filters['unassigned'] === 'true') {
            $query->whereNull('assigned_to')->whereNotNull('department_id');
        }

        if (! empty($filters['overdue']) && $filters['overdue'] === 'true') {
            $query->whereNotIn('status', ['closed', 'cancelled', 'completed'])
                ->whereDate('due_date', '<', now());
        }

        if (! empty($filters['blocked']) && $filters['blocked'] === 'true') {
            $query->where('status', 'blocked');
        }

        if (! empty($filters['escalated']) && $filters['escalated'] === 'true') {
            $query->where('escalation_level', '>', 0);
        }

        if (! empty($filters['search'])) {
            $term = $filters['search'];
            $query->where(function ($q) use ($term) {
                $q->where('reference_number', 'ilike', "%{$term}%")
                    ->orWhere('title', 'ilike', "%{$term}%")
                    ->orWhere('description', 'ilike', "%{$term}%")
                    ->orWhere('source_reference', 'ilike', "%{$term}%");
            });
        }

        $paginator = $query->paginate($filters['per_page'] ?? 20);

        $paginator->getCollection()->transform(fn (Assignment $a) => $this->redactIfNeeded($a, $user));

        return $paginator;
    }

    public function mine(array $filters, User $user): LengthAwarePaginator
    {
        $filters['scope'] = 'mine';

        return $this->list($filters, $user);
    }

    public function team(array $filters, User $user): LengthAwarePaginator
    {
        if (! $this->canViewTeam($user)) {
            throw ValidationException::withMessages(['auth' => 'Not authorised to view team assignments.']);
        }
        $filters['scope'] = 'team';

        return $this->list($filters, $user);
    }

    public function reviewQueue(array $filters, User $user): LengthAwarePaginator
    {
        $filters['scope'] = 'review';
        $filters['review_status'] = $filters['review_status'] ?? 'pending';

        return $this->list($filters, $user);
    }

    public function stats(User $user): array
    {
        $base = Assignment::query()->where('is_template', false);
        $this->applyVisibilityScope($base, $user, null);

        $total = (clone $base)->count();
        $pending = (clone $base)->whereIn('status', ['draft', 'awaiting_acceptance', 'issued'])->count();
        $in_progress = (clone $base)->whereIn('status', ['active', 'at_risk', 'blocked', 'delayed', 'accepted', 'returned'])->count();
        $active = $in_progress;
        $overdue = (clone $base)->whereNotIn('status', ['closed', 'cancelled', 'completed'])->whereDate('due_date', '<', now())->count();
        $due_soon = (clone $base)->whereNotIn('status', ['closed', 'cancelled', 'completed'])->whereBetween('due_date', [now(), now()->addDays(7)])->count();
        $awaiting = (clone $base)->where('status', 'awaiting_acceptance')->count();
        $blocked = (clone $base)->where('status', 'blocked')->count();
        $completed = (clone $base)->whereIn('status', ['closed', 'completed'])->count();
        $my_pending = Assignment::where('assigned_to', $user->id)
            ->whereIn('status', ['issued', 'awaiting_acceptance'])->count();
        $awaiting_my_review = Assignment::where('reviewer_id', $user->id)
            ->where('review_status', 'pending')->count();
        $unassigned = Assignment::where('tenant_id', $user->tenant_id)
            ->whereNull('assigned_to')
            ->whereNotNull('department_id')
            ->whereNotIn('status', ['closed', 'cancelled'])
            ->count();
        $escalated = (clone $base)->where('escalation_level', '>', 0)->whereNotIn('status', ['closed', 'cancelled'])->count();

        $by_priority = (clone $base)
            ->whereNotIn('status', ['closed', 'cancelled'])
            ->selectRaw('priority, count(*) as count')
            ->groupBy('priority')
            ->pluck('count', 'priority')
            ->toArray();

        $by_status = (clone $base)
            ->selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        return compact(
            'total', 'pending', 'in_progress', 'active', 'overdue', 'due_soon',
            'awaiting', 'blocked', 'completed', 'my_pending', 'awaiting_my_review',
            'unassigned', 'escalated', 'by_priority', 'by_status'
        );
    }

    public function reportsSummary(User $user): array
    {
        $stats = $this->stats($user);

        $bySource = Assignment::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('is_template', false)
            ->selectRaw('source_type, count(*) as count')
            ->groupBy('source_type')
            ->pluck('count', 'source_type')
            ->toArray();

        $blockerSplit = Assignment::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('status', 'blocked')
            ->selectRaw('blocker_type, count(*) as count')
            ->groupBy('blocker_type')
            ->pluck('count', 'blocker_type')
            ->toArray();

        // Explicit: no leaderboards / automated performance scores.
        return [
            'stats' => $stats,
            'by_source' => $bySource,
            'blockers' => $blockerSplit,
            'performance_scoring' => 'disabled',
        ];
    }

    /** Weekly Summary integration contract — read-only feed. */
    public function weeklySummaryFeed(User $user, ?string $periodStart = null, ?string $periodEnd = null): array
    {
        $start = $periodStart ? now()->parse($periodStart)->startOfDay() : now()->startOfWeek();
        $end = $periodEnd ? now()->parse($periodEnd)->endOfDay() : now()->endOfWeek();

        $base = Assignment::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('is_template', false)
            ->where(function ($q) use ($user) {
                $q->where('is_confidential', false)
                    ->orWhere('assigned_to', $user->id)
                    ->orWhere('created_by', $user->id)
                    ->orWhere('reviewer_id', $user->id);
            });

        $completed = (clone $base)
            ->whereIn('status', ['completed', 'closed'])
            ->where(function ($q) use ($start, $end) {
                $q->whereBetween('closed_at', [$start, $end])
                    ->orWhereBetween('verified_at', [$start, $end]);
            })
            ->get(['id', 'reference_number', 'title', 'status', 'assigned_to', 'due_date', 'closed_at', 'is_confidential']);

        $active = (clone $base)
            ->whereIn('status', ['active', 'at_risk', 'accepted', 'returned', 'awaiting_acceptance'])
            ->get(['id', 'reference_number', 'title', 'status', 'assigned_to', 'due_date', 'progress_percent', 'is_confidential']);

        $overdue = (clone $base)
            ->whereNotIn('status', ['closed', 'cancelled', 'completed'])
            ->whereDate('due_date', '<', now())
            ->get(['id', 'reference_number', 'title', 'status', 'assigned_to', 'due_date', 'is_confidential']);

        $blocked = (clone $base)
            ->where('status', 'blocked')
            ->get(['id', 'reference_number', 'title', 'blocker_type', 'blocker_owner_id', 'assigned_to', 'is_confidential']);

        $upcoming = (clone $base)
            ->whereNotIn('status', ['closed', 'cancelled', 'completed'])
            ->whereBetween('due_date', [now(), now()->addDays(7)])
            ->get(['id', 'reference_number', 'title', 'due_date', 'assigned_to', 'is_confidential']);

        return [
            'period_start' => $start->toDateString(),
            'period_end' => $end->toDateString(),
            'completed' => $completed,
            'active' => $active,
            'overdue' => $overdue,
            'blocked' => $blocked,
            'upcoming_deadlines' => $upcoming,
            'counts' => [
                'completed' => $completed->count(),
                'active' => $active->count(),
                'overdue' => $overdue->count(),
                'blocked' => $blocked->count(),
                'upcoming' => $upcoming->count(),
            ],
        ];
    }

    // ── CRUD ───────────────────────────────────────────────────────────────────

    public function create(array $data, User $user): Assignment
    {
        // Drafts may omit assignee; actionable issue requires primary or department queue (§116).
        if (! empty($data['require_owner']) || (($data['status'] ?? 'draft') !== 'draft' && empty($data['is_template']))) {
            $this->assertPrimaryOwnerRules($data);
        }

        return DB::transaction(function () use ($data, $user) {
            $assignment = Assignment::create([
                'tenant_id' => $user->tenant_id,
                'reference_number' => $this->nextReference(),
                'title' => $data['title'],
                'description' => $data['description'],
                'objective' => $data['objective'] ?? null,
                'expected_output' => $data['expected_output'] ?? null,
                'acceptance_criteria' => $data['acceptance_criteria'] ?? null,
                'evidence_required' => (bool) ($data['evidence_required'] ?? false),
                'completion_instructions' => $data['completion_instructions'] ?? null,
                'type' => $data['type'] ?? 'individual',
                'priority' => $data['priority'] ?? 'medium',
                'status' => 'draft',
                'created_by' => $user->id,
                'assigned_to' => $data['assigned_to'] ?? null,
                'department_id' => $data['department_id'] ?? null,
                'department_claim_due_at' => $data['department_claim_due_at'] ?? (
                    empty($data['assigned_to']) && ! empty($data['department_id'])
                        ? now()->addDay()
                        : null
                ),
                'due_date' => $data['due_date'],
                'start_date' => $data['start_date'] ?? null,
                'checkin_frequency' => $data['checkin_frequency'] ?? null,
                'linked_programme_id' => $data['linked_programme_id'] ?? null,
                'linked_event_id' => $data['linked_event_id'] ?? null,
                'meeting_minutes_id' => $data['meeting_minutes_id'] ?? null,
                'source_type' => $data['source_type'] ?? 'manual',
                'source_id' => $data['source_id'] ?? null,
                'source_reference' => $data['source_reference'] ?? null,
                'source_title' => $data['source_title'] ?? null,
                'source_purpose' => $data['source_purpose'] ?? null,
                'is_confidential' => (bool) ($data['is_confidential'] ?? false),
                'review_required' => (bool) ($data['review_required'] ?? false),
                'reviewer_id' => $data['reviewer_id'] ?? null,
                'review_status' => 'none',
                'parent_id' => $data['parent_id'] ?? null,
                'is_template' => (bool) ($data['is_template'] ?? false),
                'recurrence_rule' => $data['recurrence_rule'] ?? null,
                'recurrence_next_run_at' => $data['recurrence_next_run_at'] ?? null,
            ]);

            $this->syncParticipants($assignment, $data, $user);
            $this->recordEvent($assignment, $user, 'created', null, [
                'reference' => $assignment->reference_number,
                'assigned_to' => $assignment->assigned_to,
            ]);

            AuditLog::record('assignment.created', [
                'auditable_type' => Assignment::class,
                'auditable_id' => $assignment->id,
                'new_values' => ['reference' => $assignment->reference_number, 'title' => $assignment->title],
                'tags' => 'assignments',
            ]);

            return $assignment->load(['creator', 'assignee', 'department', 'reviewer', 'participants.user']);
        });
    }

    public function createFromSource(array $data, User $user): Assignment
    {
        $sourceType = $data['source_type'] ?? '';
        if (! in_array($sourceType, Assignment::SOURCE_ALLOW_LIST, true) || $sourceType === 'manual') {
            throw ValidationException::withMessages([
                'source_type' => 'Source type is not in the Phase 1 allow-list.',
            ]);
        }

        if (empty($data['source_id'])) {
            throw ValidationException::withMessages(['source_id' => 'Source record id is required.']);
        }

        $purpose = $data['source_purpose'] ?? 'default';

        $existing = Assignment::withTrashed()
            ->where('tenant_id', $user->tenant_id)
            ->where('source_type', $sourceType)
            ->where('source_id', $data['source_id'])
            ->where('source_purpose', $purpose)
            ->first();

        if ($existing && ! $existing->trashed()) {
            return $existing->load(['creator', 'assignee', 'department', 'reviewer', 'participants.user']);
        }

        $confidential = (bool) ($data['is_confidential'] ?? false);
        // Inheritance: if caller marks confidential OR source payload says so.
        if (! empty($data['source_confidential'])) {
            $confidential = true;
        }

        $payload = array_merge($data, [
            'source_type' => $sourceType,
            'source_purpose' => $purpose,
            'is_confidential' => $confidential,
        ]);

        return $this->create($payload, $user);
    }

    public function update(Assignment $assignment, array $data, User $user): Assignment
    {
        $assignment->assertEditable();
        if (! $assignment->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft assignments can be edited via update. Use reassign / change-due-date for controlled changes.']);
        }

        if (isset($data['assigned_to']) || isset($data['department_id'])) {
            $this->assertPrimaryOwnerRules(array_merge($assignment->toArray(), $data));
        }

        $assignment->update(array_filter($data, fn ($v) => $v !== null));
        $this->syncParticipants($assignment, $data, $user);

        AuditLog::record('assignment.updated', [
            'auditable_type' => Assignment::class,
            'auditable_id' => $assignment->id,
            'new_values' => $data,
            'tags' => 'assignments',
        ]);

        return $assignment->fresh(['creator', 'assignee', 'department', 'reviewer', 'participants.user']);
    }

    public function delete(Assignment $assignment, User $user): void
    {
        if (! $assignment->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft assignments can be deleted.']);
        }

        AuditLog::record('assignment.deleted', [
            'auditable_type' => Assignment::class,
            'auditable_id' => $assignment->id,
            'new_values' => ['reference' => $assignment->reference_number],
            'tags' => 'assignments',
        ]);

        $assignment->delete();
    }

    public function show(Assignment $assignment, User $user): Assignment
    {
        $assignment->load([
            'creator', 'assignee', 'department', 'reviewer', 'blockerOwner', 'verifier',
            'updates.submitter', 'attachments.uploader', 'participants.user',
            'checklistItems', 'reviews.reviewer', 'events.actor', 'subtasks.assignee',
        ]);

        return $this->redactIfNeeded($assignment, $user);
    }

    // ── Workflow ───────────────────────────────────────────────────────────────

    public function issue(Assignment $assignment, User $user): Assignment
    {
        if (! $assignment->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft assignments can be issued.']);
        }
        if (! $assignment->assigned_to && ! $assignment->department_id) {
            throw ValidationException::withMessages(['assigned_to' => 'Primary assignee or department queue is required before issue.']);
        }
        if (! $assignment->assigned_to && $assignment->department_id && ! $assignment->department_claim_due_at) {
            $assignment->department_claim_due_at = now()->addDay();
        }

        $assignment->update([
            'status' => 'awaiting_acceptance',
            'issued_at' => now(),
        ]);

        $this->scheduleReminders($assignment);
        $this->logUpdate($assignment, $user, 'system', 'Assignment issued and sent for acceptance.');
        $this->recordEvent($assignment, $user, 'issued', null, ['status' => 'awaiting_acceptance']);

        $assignment->loadMissing('assignee');
        if ($assignment->assignee) {
            $this->notificationService->dispatch($assignment->assignee, 'assignment.issued', [
                'name' => $assignment->assignee->name,
                'task_title' => $assignment->title,
                'due_date' => $assignment->due_date,
                'description' => $assignment->description ?? '',
                'issuer' => $user->name,
                'reference' => $assignment->reference_number,
            ], ['module' => 'assignments', 'record_id' => $assignment->id, 'url' => '/assignments/' . $assignment->id]);
        }

        return $assignment->fresh(['creator', 'assignee', 'department', 'updates.submitter', 'participants.user']);
    }

    public function accept(Assignment $assignment, array $data, User $user): Assignment
    {
        if (! in_array($assignment->status, ['issued', 'awaiting_acceptance'], true)) {
            throw ValidationException::withMessages(['status' => 'Assignment is not awaiting acceptance.']);
        }

        $decision = $data['decision'] ?? 'accepted';

        $assignment->update([
            'status' => $decision === 'accepted' ? 'accepted' : 'awaiting_acceptance',
            'acceptance_decision' => $decision,
            'acceptance_notes' => $data['notes'] ?? null,
            'proposed_deadline' => $data['proposed_deadline'] ?? null,
            'accepted_at' => $decision === 'accepted' ? now() : null,
            'claimed_at' => $decision === 'accepted' && ! $assignment->claimed_at ? now() : $assignment->claimed_at,
        ]);

        $noteText = match ($decision) {
            'accepted' => 'Assignment accepted.',
            'clarification_requested' => 'Clarification requested: ' . ($data['notes'] ?? ''),
            'deadline_proposed' => 'New deadline proposed: ' . ($data['proposed_deadline'] ?? ''),
            'rejected' => 'Assignment declined: ' . ($data['notes'] ?? ''),
            default => 'Acceptance response submitted.',
        };

        $this->logUpdate($assignment, $user, 'update', $noteText);
        $this->recordEvent($assignment, $user, 'acceptance', null, ['decision' => $decision]);

        $assignment->loadMissing('creator');
        if ($assignment->creator && (int) $assignment->creator->id !== (int) $user->id) {
            $this->notificationService->dispatch($assignment->creator, 'assignment.accepted', [
                'name' => $assignment->creator->name,
                'task_title' => $assignment->title,
                'reference' => $assignment->reference_number,
                'assignee' => $user->name,
                'decision' => $decision,
                'notes' => $data['notes'] ?? '',
            ], ['module' => 'assignments', 'record_id' => $assignment->id, 'url' => '/assignments/' . $assignment->id]);
        }

        return $assignment->fresh(['creator', 'assignee', 'department', 'updates.submitter']);
    }

    public function claim(Assignment $assignment, array $data, User $user): Assignment
    {
        if ($assignment->assigned_to) {
            throw ValidationException::withMessages(['assigned_to' => 'Assignment already has a primary assignee.']);
        }
        if (! $assignment->department_id) {
            throw ValidationException::withMessages(['department_id' => 'Only department-queue assignments can be claimed.']);
        }

        $old = ['assigned_to' => null];
        $assignment->update([
            'assigned_to' => $data['assigned_to'] ?? $user->id,
            'claimed_at' => now(),
            'status' => in_array($assignment->status, ['draft', 'issued'], true)
                ? 'awaiting_acceptance'
                : $assignment->status,
        ]);

        $this->recordEvent($assignment, $user, 'claimed', $old, ['assigned_to' => $assignment->assigned_to]);
        $this->logUpdate($assignment, $user, 'system', 'Primary assignee claimed from department queue.');

        return $assignment->fresh(['creator', 'assignee', 'department']);
    }

    public function start(Assignment $assignment, User $user): Assignment
    {
        if (! in_array($assignment->status, ['accepted', 'issued', 'returned'], true)) {
            throw ValidationException::withMessages(['status' => 'Assignment must be accepted before starting.']);
        }

        $assignment->update(['status' => 'active']);
        $this->logUpdate($assignment, $user, 'system', 'Assignment marked as active / in progress.');
        $this->recordEvent($assignment, $user, 'started', null, ['status' => 'active']);

        return $assignment->fresh(['creator', 'assignee', 'department', 'updates.submitter']);
    }

    public function addUpdate(Assignment $assignment, array $data, User $user): AssignmentUpdate
    {
        $assignment->assertEditable();
        if (! in_array($assignment->status, ['active', 'at_risk', 'blocked', 'delayed', 'accepted', 'returned'], true)) {
            throw ValidationException::withMessages(['status' => 'Cannot add updates to this assignment in its current state.']);
        }

        if (! empty($data['blocker_type'])) {
            if (empty($data['blocker_owner_id']) && empty($assignment->blocker_owner_id)) {
                throw ValidationException::withMessages([
                    'blocker_owner_id' => 'A blocked assignment must identify the blocker owner.',
                ]);
            }
        }

        $newStatus = $assignment->status;
        if (! empty($data['blocker_type'])) {
            $newStatus = 'blocked';
        } elseif ($assignment->status === 'blocked' && empty($data['blocker_type'])) {
            $newStatus = 'active';
        } elseif (! empty($data['progress_percent'])) {
            $pct = (int) $data['progress_percent'];
            if ($pct < 100) {
                $daysLeft = now()->diffInDays($assignment->due_date, false);
                $newStatus = ($daysLeft <= 3 && $pct < 70) ? 'at_risk' : 'active';
            } else {
                $newStatus = 'active';
            }
        }

        $update = AssignmentUpdate::create([
            'tenant_id' => $user->tenant_id,
            'assignment_id' => $assignment->id,
            'submitted_by' => $user->id,
            'type' => $data['type'] ?? 'update',
            'progress_percent' => $data['progress_percent'] ?? null,
            'notes' => $data['notes'],
            'blocker_type' => $data['blocker_type'] ?? null,
            'blocker_details' => $data['blocker_details'] ?? null,
        ]);

        $assignment->update([
            'status' => $newStatus,
            'progress_percent' => $data['progress_percent'] ?? $assignment->progress_percent,
            'blocker_type' => $data['blocker_type'] ?? $assignment->blocker_type,
            'blocker_details' => $data['blocker_details'] ?? $assignment->blocker_details,
            'blocker_owner_id' => $data['blocker_owner_id'] ?? $assignment->blocker_owner_id,
            'blocker_expected_resolution_at' => $data['blocker_expected_resolution_at'] ?? $assignment->blocker_expected_resolution_at,
        ]);

        return $update->load('submitter');
    }

    public function block(Assignment $assignment, array $data, User $user): Assignment
    {
        $assignment->assertEditable();
        if (empty($data['blocker_type']) || empty($data['blocker_owner_id'])) {
            throw ValidationException::withMessages([
                'blocker_type' => 'Blocker type and blocker owner are required.',
            ]);
        }

        $assignment->update([
            'status' => 'blocked',
            'blocker_type' => $data['blocker_type'],
            'blocker_details' => $data['blocker_details'] ?? null,
            'blocker_owner_id' => $data['blocker_owner_id'],
            'blocker_expected_resolution_at' => $data['blocker_expected_resolution_at'] ?? null,
        ]);

        $this->logUpdate($assignment, $user, 'update', 'Blocked: ' . ($data['blocker_details'] ?? $data['blocker_type']));
        $this->recordEvent($assignment, $user, 'blocked', null, [
            'blocker_type' => $data['blocker_type'],
            'blocker_owner_id' => $data['blocker_owner_id'],
        ]);

        return $assignment->fresh(['creator', 'assignee', 'blockerOwner']);
    }

    public function unblock(Assignment $assignment, array $data, User $user): Assignment
    {
        $assignment->assertEditable();
        $assignment->update([
            'status' => 'active',
            'blocker_type' => null,
            'blocker_details' => null,
            'blocker_owner_id' => null,
            'blocker_expected_resolution_at' => null,
        ]);
        $this->logUpdate($assignment, $user, 'update', $data['notes'] ?? 'Blocker cleared.');
        $this->recordEvent($assignment, $user, 'unblocked', null, ['status' => 'active']);

        return $assignment->fresh(['creator', 'assignee']);
    }

    public function complete(Assignment $assignment, array $data, User $user): Assignment
    {
        $assignment->assertEditable();
        if (! $assignment->isActive() && $assignment->status !== 'accepted') {
            throw ValidationException::withMessages(['status' => 'Only active assignments can be submitted for completion.']);
        }

        if ($assignment->evidence_required && empty($data['notes']) && $assignment->attachments()->count() === 0) {
            throw ValidationException::withMessages(['notes' => 'Evidence is required for this assignment.']);
        }

        // Mandatory checklist items must be complete
        $openMandatory = $assignment->checklistItems()->where('mandatory', true)->where('completed', false)->count();
        if ($openMandatory > 0) {
            throw ValidationException::withMessages(['checklist' => 'All mandatory checklist items must be completed.']);
        }

        $reviewPending = (bool) $assignment->review_required;

        $assignment->update([
            'status' => 'completed',
            'progress_percent' => 100,
            'closure_notes' => $data['notes'] ?? null,
            'review_status' => $reviewPending ? 'pending' : $assignment->review_status,
        ]);

        $this->logUpdate($assignment, $user, 'closure_request', 'Assignment submitted for ' . ($reviewPending ? 'review/verification' : 'closure') . '. ' . ($data['notes'] ?? ''));
        $this->recordEvent($assignment, $user, 'completed', null, [
            'review_required' => $reviewPending,
            'review_status' => $assignment->review_status,
        ]);

        $assignment->loadMissing(['creator', 'reviewer']);
        $notify = $reviewPending && $assignment->reviewer ? $assignment->reviewer : $assignment->creator;
        if ($notify && (int) $notify->id !== (int) $user->id) {
            $this->notificationService->dispatch($notify, 'assignment.completed', [
                'name' => $notify->name,
                'task_title' => $assignment->title,
                'reference' => $assignment->reference_number,
                'assignee' => $user->name,
                'notes' => $data['notes'] ?? '',
            ], ['module' => 'assignments', 'record_id' => $assignment->id, 'url' => '/assignments/' . $assignment->id]);
        }

        return $assignment->fresh(['creator', 'assignee', 'department', 'reviewer', 'updates.submitter']);
    }

    public function verify(Assignment $assignment, array $data, User $user): Assignment
    {
        if ($assignment->status !== 'completed') {
            throw ValidationException::withMessages(['status' => 'Only completed assignments can be verified.']);
        }
        if (! $assignment->review_required) {
            throw ValidationException::withMessages(['review_required' => 'This assignment does not require review; use close instead.']);
        }
        if ((int) $assignment->assigned_to === (int) $user->id) {
            throw ValidationException::withMessages(['reviewer' => 'Primary assignee cannot verify their own assignment when review is required.']);
        }
        if ($assignment->reviewer_id && (int) $assignment->reviewer_id !== (int) $user->id
            && ! $user->isSystemAdmin() && ! $user->isSecretaryGeneral()) {
            throw ValidationException::withMessages(['reviewer' => 'Only the designated reviewer may verify.']);
        }

        $decision = $data['decision'] ?? 'accepted';
        if ($decision !== 'accepted' && empty($data['comments'])) {
            throw ValidationException::withMessages(['comments' => 'Reviewer comments are mandatory when returning work.']);
        }

        $version = (int) $assignment->reviews()->max('submission_version') + 1;

        AssignmentReview::create([
            'tenant_id' => $user->tenant_id,
            'assignment_id' => $assignment->id,
            'submission_version' => max(1, $version),
            'reviewer_id' => $user->id,
            'decision' => $decision,
            'comments' => $data['comments'] ?? null,
            'acceptance_criteria_results' => $data['acceptance_criteria_results'] ?? null,
            'follow_up_required' => (bool) ($data['follow_up_required'] ?? false),
            'reviewed_at' => now(),
        ]);

        if ($decision === 'returned' || $decision === 'request_evidence') {
            $assignment->update([
                'status' => 'returned',
                'review_status' => 'returned',
                'progress_percent' => min(90, (int) $assignment->progress_percent),
            ]);
            $this->recordEvent($assignment, $user, 'returned_for_correction', null, ['decision' => $decision]);
        } else {
            $assignment->update([
                'status' => 'closed',
                'review_status' => $decision === 'accepted_with_follow_up' ? 'accepted_with_follow_up' : 'accepted',
                'verified_at' => now(),
                'verified_by' => $user->id,
                'verification_notes' => $data['comments'] ?? null,
                'closed_at' => now(),
                'closure_notes' => $data['comments'] ?? $assignment->closure_notes,
            ]);
            $this->recordEvent($assignment, $user, 'verified', null, ['decision' => $decision]);
        }

        return $assignment->fresh(['creator', 'assignee', 'reviewer', 'reviews.reviewer']);
    }

    public function close(Assignment $assignment, array $data, User $user): Assignment
    {
        if ($assignment->status !== 'completed') {
            throw ValidationException::withMessages(['status' => 'Only completed assignments can be closed.']);
        }
        if ($assignment->review_required) {
            throw ValidationException::withMessages(['review_required' => 'Use verify when review is required.']);
        }

        $assignment->update([
            'status' => 'closed',
            'closed_at' => now(),
            'closure_notes' => $data['notes'] ?? $assignment->closure_notes,
            // Optional supervisor note only — never used for automated scores/leaderboards.
            'completion_rating' => $data['rating'] ?? null,
            'has_performance_note' => ! empty($data['rating']) || ! empty($data['notes']),
        ]);

        $this->logUpdate($assignment, $user, 'system', 'Assignment closed by supervisor.' . (! empty($data['notes']) ? ' Notes: ' . $data['notes'] : ''));
        $this->recordEvent($assignment, $user, 'closed', null, ['status' => 'closed']);

        return $assignment->fresh(['creator', 'assignee', 'department', 'updates.submitter']);
    }

    public function returnAssignment(Assignment $assignment, array $data, User $user): Assignment
    {
        if ($assignment->status !== 'completed') {
            throw ValidationException::withMessages(['status' => 'Only completed assignments can be returned.']);
        }

        $assignment->update([
            'status' => 'returned',
            'review_status' => $assignment->review_required ? 'returned' : $assignment->review_status,
            'progress_percent' => $assignment->progress_percent < 100 ? $assignment->progress_percent : 90,
        ]);

        $reason = $data['reason'] ?? 'Returned by supervisor for further work.';
        $this->logUpdate($assignment, $user, 'feedback', 'Assignment returned: ' . $reason);
        $this->recordEvent($assignment, $user, 'returned', null, ['reason' => $reason]);

        $assignment->loadMissing('assignee');
        if ($assignment->assignee) {
            $this->notificationService->dispatch($assignment->assignee, 'assignment.returned', [
                'name' => $assignment->assignee->name,
                'task_title' => $assignment->title,
                'reference' => $assignment->reference_number,
                'reason' => $reason,
                'issuer' => $user->name,
            ], ['module' => 'assignments', 'record_id' => $assignment->id, 'url' => '/assignments/' . $assignment->id]);
        }

        return $assignment->fresh(['creator', 'assignee', 'department', 'updates.submitter']);
    }

    public function cancel(Assignment $assignment, array $data, User $user): Assignment
    {
        if (in_array($assignment->status, ['closed', 'cancelled'], true)) {
            throw ValidationException::withMessages(['status' => 'Assignment is already ' . $assignment->status . '.']);
        }
        if ($assignment->isVerified()) {
            throw ValidationException::withMessages(['status' => 'Verified assignments cannot be cancelled silently.']);
        }

        $assignment->update([
            'status' => 'cancelled',
            'rejection_reason' => $data['reason'] ?? null,
        ]);

        $this->logUpdate($assignment, $user, 'system', 'Assignment cancelled. ' . ($data['reason'] ?? ''));
        $this->recordEvent($assignment, $user, 'cancelled', null, ['reason' => $data['reason'] ?? null]);

        return $assignment->fresh(['creator', 'assignee', 'department', 'updates.submitter']);
    }

    public function reassign(Assignment $assignment, array $data, User $user): Assignment
    {
        $assignment->assertEditable();
        if (empty($data['assigned_to'])) {
            throw ValidationException::withMessages(['assigned_to' => 'New primary assignee is required.']);
        }
        if (empty($data['reason'])) {
            throw ValidationException::withMessages(['reason' => 'Reassignment reason is required.']);
        }

        $old = ['assigned_to' => $assignment->assigned_to];
        $assignment->update([
            'assigned_to' => $data['assigned_to'],
            'claimed_at' => now(),
            'acted_via_delegation_id' => $data['acted_via_delegation_id'] ?? null,
            'status' => in_array($assignment->status, ['draft'], true) ? $assignment->status : 'awaiting_acceptance',
            'acceptance_decision' => null,
            'accepted_at' => null,
        ]);

        $this->recordEvent($assignment, $user, 'reassigned', $old, [
            'assigned_to' => $assignment->assigned_to,
            'reason' => $data['reason'],
        ], $data['reason'], $data['acted_via_delegation_id'] ?? null);

        $this->logUpdate($assignment, $user, 'system', 'Reassigned: ' . $data['reason']);

        return $assignment->fresh(['creator', 'assignee', 'events.actor']);
    }

    public function changeDueDate(Assignment $assignment, array $data, User $user): Assignment
    {
        $assignment->assertEditable();
        if (empty($data['due_date'])) {
            throw ValidationException::withMessages(['due_date' => 'New due date is required.']);
        }
        if (empty($data['reason'])) {
            throw ValidationException::withMessages(['reason' => 'Due-date change reason is required.']);
        }

        $old = ['due_date' => optional($assignment->due_date)?->toDateString()];
        $assignment->update(['due_date' => $data['due_date']]);
        $this->recordEvent($assignment, $user, 'due_date_changed', $old, [
            'due_date' => $data['due_date'],
            'reason' => $data['reason'],
        ], $data['reason']);
        $this->scheduleReminders($assignment, true);

        return $assignment->fresh(['creator', 'assignee', 'events.actor']);
    }

    public function addParticipant(Assignment $assignment, array $data, User $user): AssignmentParticipant
    {
        $assignment->assertEditable();
        $role = $data['role'] ?? 'contributor';
        if (! in_array($role, ['contributor', 'watcher', 'reviewer'], true)) {
            throw ValidationException::withMessages(['role' => 'Invalid participant role.']);
        }

        $participant = AssignmentParticipant::firstOrCreate([
            'tenant_id' => $assignment->tenant_id,
            'assignment_id' => $assignment->id,
            'user_id' => $data['user_id'],
            'role' => $role,
        ]);

        if ($role === 'reviewer' && empty($assignment->reviewer_id)) {
            $assignment->update(['reviewer_id' => $data['user_id'], 'review_required' => true]);
        }

        $this->recordEvent($assignment, $user, 'participant_added', null, [
            'user_id' => $data['user_id'],
            'role' => $role,
        ]);

        return $participant->load('user');
    }

    public function addChecklistItem(Assignment $assignment, array $data, User $user): AssignmentChecklistItem
    {
        $assignment->assertEditable();
        $item = AssignmentChecklistItem::create([
            'tenant_id' => $assignment->tenant_id,
            'assignment_id' => $assignment->id,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'sequence' => $data['sequence'] ?? (($assignment->checklistItems()->max('sequence') ?? 0) + 1),
            'mandatory' => (bool) ($data['mandatory'] ?? false),
            'assignee_id' => $data['assignee_id'] ?? null,
            'due_at' => $data['due_at'] ?? null,
        ]);

        return $item;
    }

    public function toggleChecklistItem(AssignmentChecklistItem $item, User $user, bool $completed): AssignmentChecklistItem
    {
        $item->assignment->assertEditable();
        $item->update([
            'completed' => $completed,
            'completed_by' => $completed ? $user->id : null,
            'completed_at' => $completed ? now() : null,
        ]);

        return $item->fresh();
    }

    public function createSubtask(Assignment $parent, array $data, User $user): Assignment
    {
        $parent->assertEditable();
        $data['parent_id'] = $parent->id;
        $data['source_type'] = $parent->source_type ?: 'manual';
        $data['source_id'] = $parent->source_id;
        $data['source_reference'] = $parent->source_reference;
        $data['is_confidential'] = $parent->is_confidential;
        $data['assigned_to'] = $data['assigned_to'] ?? $parent->assigned_to;
        $data['due_date'] = $data['due_date'] ?? optional($parent->due_date)?->toDateString();

        return $this->create($data, $user);
    }

    public function createTemplate(array $data, User $user): Assignment
    {
        $data['is_template'] = true;
        $data['status'] = 'draft';
        if (empty($data['recurrence_rule'])) {
            $data['recurrence_rule'] = ['frequency' => 'weekly', 'interval' => 1];
        }
        $data['recurrence_next_run_at'] = $data['recurrence_next_run_at'] ?? now()->addDay();

        return $this->create($data, $user);
    }

    public function generateFromTemplate(Assignment $template, User $user, ?string $dueDate = null): Assignment
    {
        if (! $template->is_template) {
            throw ValidationException::withMessages(['template' => 'Assignment is not a recurring template.']);
        }

        $instance = $this->create([
            'title' => $template->title,
            'description' => $template->description,
            'objective' => $template->objective,
            'expected_output' => $template->expected_output,
            'acceptance_criteria' => $template->acceptance_criteria,
            'evidence_required' => $template->evidence_required,
            'completion_instructions' => $template->completion_instructions,
            'type' => $template->type,
            'priority' => $template->priority,
            'assigned_to' => $template->assigned_to,
            'department_id' => $template->department_id,
            'due_date' => $dueDate ?? now()->addDays(7)->toDateString(),
            'review_required' => $template->review_required,
            'reviewer_id' => $template->reviewer_id,
            'is_confidential' => $template->is_confidential,
            'source_type' => 'manual',
            'source_purpose' => 'recurring:' . $template->id . ':' . now()->format('YmdHis'),
            'contributor_ids' => $template->participants()->where('role', 'contributor')->pluck('user_id')->all(),
            'watcher_ids' => $template->participants()->where('role', 'watcher')->pluck('user_id')->all(),
        ], $user);

        $instance->update(['template_id' => $template->id, 'is_template' => false]);

        $rule = $template->recurrence_rule ?? ['frequency' => 'weekly', 'interval' => 1];
        $next = $this->nextRunFromRule($rule, $template->recurrence_next_run_at ?? now());
        $template->update(['recurrence_next_run_at' => $next]);

        $this->recordEvent($template, $user, 'instance_generated', null, ['instance_id' => $instance->id]);

        return $instance->fresh(['creator', 'assignee', 'template']);
    }

    public function processRemindersAndEscalations(): int
    {
        $processed = 0;

        AssignmentReminder::query()
            ->where('status', 'pending')
            ->where('scheduled_for', '<=', now())
            ->with('assignment.assignee', 'assignment.creator')
            ->limit(200)
            ->get()
            ->each(function (AssignmentReminder $reminder) use (&$processed) {
                $assignment = $reminder->assignment;
                if (! $assignment || in_array($assignment->status, ['closed', 'cancelled'], true)) {
                    $reminder->update(['status' => 'cancelled']);

                    return;
                }

                $target = $assignment->assignee ?? $assignment->creator;
                if ($target) {
                    $this->notificationService->dispatch($target, 'assignment.issued', [
                        'name' => $target->name,
                        'task_title' => $assignment->title,
                        'due_date' => $assignment->due_date,
                        'description' => 'Reminder: ' . $reminder->reminder_type,
                        'issuer' => 'System',
                        'reference' => $assignment->reference_number,
                    ], ['module' => 'assignments', 'record_id' => $assignment->id, 'url' => '/assignments/' . $assignment->id]);
                }

                $reminder->update(['status' => 'sent', 'sent_at' => now()]);
                $assignment->update(['last_reminded_at' => now()]);
                $processed++;
            });

        // Department queue cannot remain ownerless indefinitely.
        Assignment::query()
            ->whereNull('assigned_to')
            ->whereNotNull('department_id')
            ->whereNotNull('department_claim_due_at')
            ->where('department_claim_due_at', '<', now())
            ->whereNotIn('status', ['closed', 'cancelled'])
            ->limit(100)
            ->get()
            ->each(function (Assignment $assignment) use (&$processed) {
                $level = min(5, ((int) $assignment->escalation_level) + 1);
                $assignment->update([
                    'escalation_level' => $level,
                    'last_escalated_at' => now(),
                ]);
                $this->recordEvent($assignment, null, 'escalated_unclaimed', null, [
                    'escalation_level' => $level,
                ], 'Department queue claim overdue');
                $processed++;
            });

        // Overdue escalation (deadline state separate from work status).
        Assignment::query()
            ->whereNotNull('assigned_to')
            ->whereNotIn('status', ['closed', 'cancelled', 'completed', 'draft'])
            ->whereDate('due_date', '<', now())
            ->where(function ($q) {
                $q->whereNull('last_escalated_at')->orWhere('last_escalated_at', '<', now()->subDay());
            })
            ->limit(100)
            ->get()
            ->each(function (Assignment $assignment) use (&$processed) {
                $level = min(5, ((int) $assignment->escalation_level) + 1);
                $assignment->update([
                    'escalation_level' => $level,
                    'last_escalated_at' => now(),
                    // Do NOT overwrite work status with "delayed" — overdue is deadline_state.
                ]);
                $this->recordEvent($assignment, null, 'escalated_overdue', null, [
                    'escalation_level' => $level,
                    'deadline_state' => 'overdue',
                    'work_status' => $assignment->status,
                ]);
                $processed++;
            });

        return $processed;
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private function assertPrimaryOwnerRules(array $data): void
    {
        $assignee = $data['assigned_to'] ?? null;
        $department = $data['department_id'] ?? null;
        if (! $assignee && ! $department) {
            throw ValidationException::withMessages([
                'assigned_to' => 'Every actionable assignment needs a Primary Assignee (or a department queue with claim deadline).',
            ]);
        }
    }

    private function syncParticipants(Assignment $assignment, array $data, User $user): void
    {
        foreach (['contributor' => 'contributor_ids', 'watcher' => 'watcher_ids'] as $role => $key) {
            if (! array_key_exists($key, $data) || ! is_array($data[$key])) {
                continue;
            }
            foreach ($data[$key] as $uid) {
                AssignmentParticipant::firstOrCreate([
                    'tenant_id' => $assignment->tenant_id,
                    'assignment_id' => $assignment->id,
                    'user_id' => (int) $uid,
                    'role' => $role,
                ]);
            }
        }

        if (! empty($data['reviewer_id'])) {
            AssignmentParticipant::firstOrCreate([
                'tenant_id' => $assignment->tenant_id,
                'assignment_id' => $assignment->id,
                'user_id' => (int) $data['reviewer_id'],
                'role' => 'reviewer',
            ]);
        }
    }

    private function scheduleReminders(Assignment $assignment, bool $reset = false): void
    {
        if ($reset) {
            AssignmentReminder::where('assignment_id', $assignment->id)
                ->where('status', 'pending')
                ->update(['status' => 'cancelled']);
        }
        if (! $assignment->due_date) {
            return;
        }

        $anchors = [
            ['due_soon', $assignment->due_date->copy()->subDays(3)->startOfDay()],
            ['due_today', $assignment->due_date->copy()->startOfDay()],
            ['overdue', $assignment->due_date->copy()->addDay()->startOfDay()],
        ];

        foreach ($anchors as [$type, $when]) {
            if ($when->isPast()) {
                continue;
            }
            AssignmentReminder::create([
                'tenant_id' => $assignment->tenant_id,
                'assignment_id' => $assignment->id,
                'reminder_type' => $type,
                'scheduled_for' => $when,
                'status' => 'pending',
            ]);
        }
    }

    private function applyVisibilityScope($query, User $user, ?string $scope): void
    {
        $isManager = $this->canViewTeam($user);

        if ($scope === 'mine') {
            $query->where(function ($q) use ($user) {
                $q->where('assigned_to', $user->id)
                    ->orWhere('created_by', $user->id)
                    ->orWhereHas('participants', fn ($p) => $p->where('user_id', $user->id));
            });

            return;
        }

        if ($scope === 'team') {
            if ($user->department_id) {
                $query->where(function ($q) use ($user) {
                    $q->where('department_id', $user->department_id)
                        ->orWhereHas('assignee', fn ($a) => $a->where('department_id', $user->department_id));
                });
            }

            return;
        }

        if ($scope === 'review') {
            $query->where(function ($q) use ($user) {
                $q->where('reviewer_id', $user->id)
                    ->orWhereHas('participants', fn ($p) => $p->where('user_id', $user->id)->where('role', 'reviewer'));
            });

            return;
        }

        if (! $isManager) {
            $query->where(function ($q) use ($user) {
                $q->where('created_by', $user->id)
                    ->orWhere('assigned_to', $user->id)
                    ->orWhere('reviewer_id', $user->id)
                    ->orWhereHas('participants', fn ($p) => $p->where('user_id', $user->id));
            });
        }
    }

    private function canViewTeam(User $user): bool
    {
        return $user->isSystemAdmin()
            || $user->isSecretaryGeneral()
            || $user->hasAnyRole(['HR Manager', 'Finance Controller', 'Director', 'HOD'])
            || $user->can('assignments.admin')
            || $user->can('assignments.team');
    }

    private function redactIfNeeded(Assignment $assignment, User $user): Assignment
    {
        if (! $assignment->is_confidential) {
            return $assignment;
        }

        $allowed = (int) $assignment->assigned_to === (int) $user->id
            || (int) $assignment->created_by === (int) $user->id
            || (int) $assignment->reviewer_id === (int) $user->id
            || $user->can('assignments.confidential.view')
            || $user->isSystemAdmin()
            || $assignment->participants->contains(fn ($p) => (int) $p->user_id === (int) $user->id);

        if ($allowed) {
            return $assignment;
        }

        $assignment->title = '[Confidential]';
        $assignment->description = 'Restricted — confidentiality inherited from source.';
        $assignment->source_title = null;
        $assignment->setRelation('attachments', collect());

        return $assignment;
    }

    private function nextReference(): string
    {
        $year = now()->format('Y');
        $seq = Assignment::withTrashed()
            ->whereYear('created_at', (int) $year)
            ->count() + 1;

        return 'ASN/' . $year . '/' . str_pad((string) $seq, 5, '0', STR_PAD_LEFT);
    }

    private function nextRunFromRule(array $rule, $from)
    {
        $from = $from instanceof \Carbon\Carbon ? $from->copy() : now()->parse($from);
        $interval = max(1, (int) ($rule['interval'] ?? 1));
        $freq = $rule['frequency'] ?? 'weekly';

        return match ($freq) {
            'daily' => $from->addDays($interval),
            'monthly' => $from->addMonths($interval),
            default => $from->addWeeks($interval),
        };
    }

    private function recordEvent(
        Assignment $assignment,
        ?User $user,
        string $type,
        ?array $old,
        ?array $new,
        ?string $notes = null,
        ?int $delegationId = null
    ): AssignmentEvent {
        return AssignmentEvent::create([
            'tenant_id' => $assignment->tenant_id,
            'assignment_id' => $assignment->id,
            'actor_id' => $user?->id,
            'event_type' => $type,
            'old_values' => $old,
            'new_values' => $new,
            'notes' => $notes,
            'acted_via_delegation_id' => $delegationId ?? $assignment->acted_via_delegation_id,
        ]);
    }

    private function logUpdate(Assignment $assignment, User $user, string $type, string $notes): AssignmentUpdate
    {
        return AssignmentUpdate::create([
            'tenant_id' => $user->tenant_id,
            'assignment_id' => $assignment->id,
            'submitted_by' => $user->id,
            'type' => $type,
            'notes' => $notes,
        ]);
    }
}
