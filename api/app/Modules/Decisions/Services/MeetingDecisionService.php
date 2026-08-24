<?php

namespace App\Modules\Decisions\Services;

use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\MeetingDecision;
use App\Models\MeetingDecisionAction;
use App\Models\MeetingDecisionHistory;
use App\Models\User;
use App\Modules\Assignments\Services\AssignmentService;
use App\Services\NotificationService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MeetingDecisionService
{
    public function __construct(
        private readonly AssignmentService $assignments,
        private readonly NotificationService $notifications,
    ) {}

    public function list(User $user, array $filters = []): LengthAwarePaginator
    {
        $query = MeetingDecision::query()
            ->where('tenant_id', $user->tenant_id)
            ->with(['owner:id,name', 'creator:id,name', 'minutes:id,title,meeting_date']);

        $this->applyConfidentialityFilter($query, $user);

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['decision_type'])) {
            $query->where('decision_type', $filters['decision_type']);
        }
        if (! empty($filters['owner_id'])) {
            $query->where('owner_id', $filters['owner_id']);
        }
        if (! empty($filters['meeting_minutes_id'])) {
            $query->where('meeting_minutes_id', $filters['meeting_minutes_id']);
        }
        if (! empty($filters['q'])) {
            $q = '%'.$filters['q'].'%';
            $query->where(function ($inner) use ($q) {
                $inner->where('title', 'ilike', $q)
                    ->orWhere('reference_number', 'ilike', $q)
                    ->orWhere('body', 'ilike', $q);
            });
        }

        return $query->orderByDesc('id')->paginate((int) ($filters['per_page'] ?? 25));
    }

    public function show(MeetingDecision $decision, User $user): MeetingDecision
    {
        $this->assertTenant($decision, $user);
        $this->assertCanView($decision, $user);

        return $decision->load([
            'owner:id,name',
            'creator:id,name',
            'adopter:id,name',
            'closer:id,name',
            'minutes:id,title,meeting_date,status',
            'actions.owner:id,name',
            'actions.assignment:id,reference_number,status',
            'supersededBy:id,reference_number,title,status',
        ]);
    }

    public function create(array $data, User $user): MeetingDecision
    {
        $this->assertCanCreate($user);

        $decision = MeetingDecision::create([
            'tenant_id' => $user->tenant_id,
            'decision_type' => $data['decision_type'],
            'title' => $data['title'],
            'body' => $data['body'] ?? null,
            'status' => 'draft',
            'owner_id' => $data['owner_id'] ?? null,
            'due_date' => $data['due_date'] ?? null,
            'meeting_minutes_id' => $data['meeting_minutes_id'] ?? null,
            'workplan_event_id' => $data['workplan_event_id'] ?? null,
            'is_confidential' => (bool) ($data['is_confidential'] ?? false),
            'created_by' => $user->id,
            'source_type' => $data['source_type'] ?? null,
            'source_id' => $data['source_id'] ?? null,
            'source_purpose' => $data['source_purpose'] ?? null,
        ]);

        $this->recordHistory($decision, 'created', $user, null, 'draft', [], [
            'reference_number' => $decision->reference_number,
            'decision_type' => $decision->decision_type,
            'title' => $decision->title,
        ]);

        AuditLog::record('decision.created', [
            'auditable_type' => MeetingDecision::class,
            'auditable_id' => $decision->id,
            'new_values' => ['reference_number' => $decision->reference_number],
            'tags' => 'decisions',
        ]);

        return $decision->fresh(['owner:id,name', 'creator:id,name']);
    }

    public function update(MeetingDecision $decision, array $data, User $user): MeetingDecision
    {
        $this->assertTenant($decision, $user);
        $this->assertCanManage($decision, $user);

        if (! in_array($decision->status, ['draft'], true) && ! $this->isAdmin($user)) {
            throw ValidationException::withMessages([
                'status' => 'Only draft decisions can be edited (admins may correct metadata).',
            ]);
        }

        $before = $decision->only(['title', 'body', 'owner_id', 'due_date', 'is_confidential', 'decision_type']);

        $fillable = array_filter([
            'title' => $data['title'] ?? null,
            'body' => array_key_exists('body', $data) ? $data['body'] : null,
            'owner_id' => array_key_exists('owner_id', $data) ? $data['owner_id'] : null,
            'due_date' => array_key_exists('due_date', $data) ? $data['due_date'] : null,
            'meeting_minutes_id' => array_key_exists('meeting_minutes_id', $data) ? $data['meeting_minutes_id'] : null,
            'workplan_event_id' => array_key_exists('workplan_event_id', $data) ? $data['workplan_event_id'] : null,
            'is_confidential' => array_key_exists('is_confidential', $data) ? (bool) $data['is_confidential'] : null,
            'decision_type' => $data['decision_type'] ?? null,
        ], fn ($v) => $v !== null);

        // Allow clearing nullable fields when explicitly passed as null for draft.
        foreach (['body', 'owner_id', 'due_date', 'meeting_minutes_id', 'workplan_event_id'] as $nullable) {
            if (array_key_exists($nullable, $data) && $data[$nullable] === null) {
                $fillable[$nullable] = null;
            }
        }

        $decision->update($fillable);

        $this->recordHistory($decision, 'updated', $user, $decision->status, $decision->status, $before, $decision->only(array_keys($before)));

        return $decision->fresh(['owner:id,name', 'creator:id,name']);
    }

    public function adopt(MeetingDecision $decision, array $data, User $user): MeetingDecision
    {
        $this->assertTenant($decision, $user);

        if ($decision->status !== 'draft') {
            throw ValidationException::withMessages(['status' => 'Only draft decisions can be adopted.']);
        }

        if (! $this->canAdopt($user)) {
            abort(403, 'You do not have authority to adopt decisions.');
        }

        // Separation of duties — no self-bypass of adoption authority.
        if (! $this->canBypassAdoptionSoD($user)) {
            if ((int) $decision->created_by === (int) $user->id
                || ((int) $decision->owner_id > 0 && (int) $decision->owner_id === (int) $user->id)) {
                throw ValidationException::withMessages([
                    'adopted_by' => 'You cannot adopt a decision you drafted or own. Request adoption from an authorised officer.',
                ]);
            }
        }

        $from = $decision->status;
        $decision->update([
            'status' => 'adopted',
            'adopted_by' => $user->id,
            'adopted_at' => now(),
            'adoption_notes' => $data['adoption_notes'] ?? null,
            'owner_id' => $data['owner_id'] ?? $decision->owner_id,
            'due_date' => $data['due_date'] ?? $decision->due_date,
        ]);

        $this->recordHistory($decision, 'adopted', $user, $from, 'adopted', [], [
            'adopted_by' => $user->id,
            'adoption_notes' => $decision->adoption_notes,
        ], $data['adoption_notes'] ?? null);

        AuditLog::record('decision.adopted', [
            'auditable_type' => MeetingDecision::class,
            'auditable_id' => $decision->id,
            'new_values' => ['status' => 'adopted'],
            'tags' => 'decisions',
        ]);

        if ($decision->owner_id) {
            $owner = User::find($decision->owner_id);
            if ($owner) {
                $this->notifications->dispatch($owner, 'decision.adopted', [
                    'name' => $owner->name,
                    'reference' => $decision->reference_number,
                    'title' => $this->visibleTitle($decision, $owner),
                    'adopter' => $user->name,
                ], [
                    'module' => 'decisions',
                    'url' => '/decisions/'.$decision->id,
                    'record_id' => $decision->id,
                ]);
            }
        }

        return $decision->fresh(['owner:id,name', 'adopter:id,name', 'creator:id,name']);
    }

    public function startProgress(MeetingDecision $decision, User $user): MeetingDecision
    {
        $this->assertTenant($decision, $user);
        $this->assertCanManage($decision, $user);

        if ($decision->status !== 'adopted') {
            throw ValidationException::withMessages(['status' => 'Only adopted decisions can move to in progress.']);
        }

        $from = $decision->status;
        $decision->update(['status' => 'in_progress']);
        $this->recordHistory($decision, 'started', $user, $from, 'in_progress');

        return $decision->fresh(['owner:id,name']);
    }

    public function markImplemented(MeetingDecision $decision, array $data, User $user): MeetingDecision
    {
        $this->assertTenant($decision, $user);
        $this->assertCanManage($decision, $user);

        if (! in_array($decision->status, ['adopted', 'in_progress'], true)) {
            throw ValidationException::withMessages(['status' => 'Decision cannot be marked implemented from its current status.']);
        }

        $from = $decision->status;
        $decision->update([
            'status' => 'implemented',
            'implemented_at' => now(),
        ]);

        $this->recordHistory($decision, 'implemented', $user, $from, 'implemented', [], [
            'notes' => $data['notes'] ?? null,
        ], $data['notes'] ?? null);

        AuditLog::record('decision.implemented', [
            'auditable_type' => MeetingDecision::class,
            'auditable_id' => $decision->id,
            'new_values' => ['status' => 'implemented'],
            'tags' => 'decisions',
        ]);

        return $decision->fresh(['owner:id,name']);
    }

    public function close(MeetingDecision $decision, array $data, User $user): MeetingDecision
    {
        $this->assertTenant($decision, $user);
        $this->assertCanManage($decision, $user);

        if (! in_array($decision->status, ['implemented', 'in_progress'], true) && ! $this->isAdmin($user)) {
            throw ValidationException::withMessages(['status' => 'Decision must be implemented before close.']);
        }

        if (config('decisions.block_close_with_open_critical_actions', true)) {
            $openCritical = $decision->openCriticalActions()->count();
            if ($openCritical > 0) {
                throw ValidationException::withMessages([
                    'actions' => "Cannot close while {$openCritical} open critical action(s) remain.",
                ]);
            }
        }

        $from = $decision->status;
        $decision->update([
            'status' => 'closed',
            'closed_by' => $user->id,
            'closed_at' => now(),
            'closure_notes' => $data['closure_notes'] ?? null,
        ]);

        $this->recordHistory($decision, 'closed', $user, $from, 'closed', [], [
            'closure_notes' => $decision->closure_notes,
        ], $data['closure_notes'] ?? null);

        AuditLog::record('decision.closed', [
            'auditable_type' => MeetingDecision::class,
            'auditable_id' => $decision->id,
            'new_values' => ['status' => 'closed'],
            'tags' => 'decisions',
        ]);

        return $decision->fresh(['owner:id,name', 'closer:id,name']);
    }

    public function supersede(MeetingDecision $decision, array $data, User $user): MeetingDecision
    {
        $this->assertTenant($decision, $user);
        if (! $this->canAdopt($user) && ! $this->isAdmin($user)) {
            abort(403, 'You do not have authority to supersede decisions.');
        }

        if (in_array($decision->status, ['draft', 'superseded'], true)) {
            throw ValidationException::withMessages(['status' => 'Decision cannot be superseded from its current status.']);
        }

        $replacement = MeetingDecision::where('tenant_id', $user->tenant_id)
            ->where('id', $data['superseded_by_id'])
            ->firstOrFail();

        $from = $decision->status;
        $decision->update([
            'status' => 'superseded',
            'superseded_by_id' => $replacement->id,
            'closed_at' => now(),
            'closed_by' => $user->id,
            'closure_notes' => $data['notes'] ?? ('Superseded by '.$replacement->reference_number),
        ]);

        $this->recordHistory($decision, 'superseded', $user, $from, 'superseded', [], [
            'superseded_by_id' => $replacement->id,
            'superseded_by_ref' => $replacement->reference_number,
        ], $data['notes'] ?? null);

        return $decision->fresh(['supersededBy:id,reference_number,title']);
    }

    public function delete(MeetingDecision $decision, User $user): void
    {
        $this->assertTenant($decision, $user);
        $this->assertCanManage($decision, $user);

        if ($decision->status !== 'draft' && ! $this->isAdmin($user)) {
            throw ValidationException::withMessages(['status' => 'Only draft decisions can be deleted.']);
        }

        $this->recordHistory($decision, 'deleted', $user, $decision->status, $decision->status);
        $decision->delete();
    }

    public function addAction(MeetingDecision $decision, array $data, User $user, bool $createAssignment = true): MeetingDecisionAction
    {
        $this->assertTenant($decision, $user);
        $this->assertCanManage($decision, $user);

        if (in_array($decision->status, ['closed', 'superseded'], true)) {
            throw ValidationException::withMessages(['status' => 'Cannot add actions to a closed or superseded decision.']);
        }

        $action = $decision->actions()->create([
            'tenant_id' => $decision->tenant_id,
            'created_by' => $user->id,
            'owner_id' => $data['owner_id'] ?? $decision->owner_id,
            'description' => $data['description'],
            'notes' => $data['notes'] ?? null,
            'priority' => $data['priority'] ?? 'medium',
            'status' => 'open',
            'due_date' => $data['due_date'] ?? $decision->due_date,
        ]);

        if ($createAssignment && ($data['create_assignment'] ?? true) && $action->owner_id && $action->due_date) {
            $assignment = $this->createAssignmentForAction($action, $user, $data);
            $action->update(['assignment_id' => $assignment->id, 'status' => 'in_progress']);
        }

        $this->recordHistory($decision, 'action_added', $user, $decision->status, $decision->status, [], [
            'action_id' => $action->id,
            'description' => $action->description,
            'priority' => $action->priority,
            'assignment_id' => $action->assignment_id,
        ]);

        return $action->load(['owner:id,name', 'assignment:id,reference_number,status']);
    }

    public function createAssignmentForDecision(MeetingDecision $decision, User $user, array $data = []): Assignment
    {
        $this->assertTenant($decision, $user);
        $this->assertCanManage($decision, $user);

        if (! in_array($decision->status, ['adopted', 'in_progress', 'implemented'], true)) {
            throw ValidationException::withMessages([
                'status' => 'Assignments can only be created from adopted (or later) decisions.',
            ]);
        }

        $assignment = $this->assignments->createFromSource([
            'source_type' => 'meeting_decision',
            'source_id' => $decision->id,
            'source_purpose' => $data['source_purpose'] ?? 'implementation',
            'source_reference' => $decision->reference_number,
            'source_title' => $decision->title,
            'title' => $data['title'] ?? ('Implement: '.$decision->title),
            'description' => $data['description'] ?? ($decision->body ?: $decision->title),
            'assigned_to' => $data['assigned_to'] ?? $decision->owner_id,
            'due_date' => $data['due_date'] ?? ($decision->due_date?->toDateString() ?? now()->addDays(14)->toDateString()),
            'priority' => $data['priority'] ?? 'medium',
            'is_confidential' => (bool) $decision->is_confidential,
            'source_confidential' => (bool) $decision->is_confidential,
            'meeting_minutes_id' => $decision->meeting_minutes_id,
        ], $user);

        $this->recordHistory($decision, 'assignment_linked', $user, $decision->status, $decision->status, [], [
            'assignment_id' => $assignment->id,
            'source_purpose' => $data['source_purpose'] ?? 'implementation',
        ]);

        if ($decision->status === 'adopted' && empty($data['preserve_status'])) {
            $decision->update(['status' => 'in_progress']);
            $this->recordHistory($decision, 'started', $user, 'adopted', 'in_progress', [], [
                'reason' => 'assignment_created',
            ]);
        }

        return $assignment;
    }

    public function createAssignmentForAction(MeetingDecisionAction $action, User $user, array $data = []): Assignment
    {
        $action->loadMissing('decision');
        $decision = $action->decision;
        $this->assertTenant($decision, $user);

        return $this->assignments->createFromSource([
            'source_type' => 'meeting_decision_action',
            'source_id' => $action->id,
            'source_purpose' => 'follow_up',
            'source_reference' => $decision->reference_number,
            'source_title' => $decision->title,
            'title' => $data['assignment_title'] ?? ('Decision action: '.$action->description),
            'description' => $data['assignment_description'] ?? ($action->notes ?: $action->description),
            'assigned_to' => $data['assigned_to'] ?? $action->owner_id,
            'due_date' => $action->due_date?->toDateString()
                ?? $decision->due_date?->toDateString()
                ?? now()->addDays(14)->toDateString(),
            'priority' => $action->priority === 'critical' ? 'critical' : ($action->priority === 'high' ? 'high' : 'medium'),
            'is_confidential' => (bool) $decision->is_confidential,
            'source_confidential' => (bool) $decision->is_confidential,
            'meeting_minutes_id' => $decision->meeting_minutes_id,
        ], $user);
    }

    public function updateAction(MeetingDecisionAction $action, array $data, User $user): MeetingDecisionAction
    {
        $action->loadMissing('decision');
        $this->assertTenant($action->decision, $user);
        $this->assertCanManage($action->decision, $user);

        $fillable = array_filter([
            'description' => $data['description'] ?? null,
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : null,
            'priority' => $data['priority'] ?? null,
            'status' => $data['status'] ?? null,
            'owner_id' => array_key_exists('owner_id', $data) ? $data['owner_id'] : null,
            'due_date' => array_key_exists('due_date', $data) ? $data['due_date'] : null,
        ], fn ($v) => $v !== null);

        if (($fillable['status'] ?? null) === 'completed') {
            $fillable['completed_at'] = now();
        }

        $action->update($fillable);

        return $action->fresh(['owner:id,name', 'assignment:id,reference_number,status']);
    }

    public function dashboard(User $user): array
    {
        $base = MeetingDecision::query()->where('tenant_id', $user->tenant_id);
        $this->applyConfidentialityFilter($base, $user);

        $byStatus = (clone $base)
            ->select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status')
            ->all();

        $overdue = (clone $base)
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', now()->toDateString())
            ->whereNotIn('status', ['closed', 'superseded', 'implemented'])
            ->count();

        $openCriticalActions = MeetingDecisionAction::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('priority', 'critical')
            ->whereIn('status', ['open', 'in_progress'])
            ->whereHas('decision', function ($q) use ($user) {
                $q->where('tenant_id', $user->tenant_id);
                $this->applyConfidentialityFilter($q, $user);
            })
            ->count();

        return [
            'by_status' => $byStatus,
            'total' => array_sum($byStatus),
            'overdue' => $overdue,
            'open_critical_actions' => $openCriticalActions,
        ];
    }

    public function recordHistory(
        MeetingDecision $decision,
        string $changeType,
        User $actor,
        ?string $fromStatus,
        ?string $toStatus,
        array $oldValues = [],
        array $newValues = [],
        ?string $notes = null,
    ): MeetingDecisionHistory {
        $payload = [
            'change_type' => $changeType,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'notes' => $notes,
            'at' => now()->toIso8601String(),
        ];

        return MeetingDecisionHistory::create([
            'tenant_id' => $decision->tenant_id,
            'meeting_decision_id' => $decision->id,
            'actor_id' => $actor->id,
            'change_type' => $changeType,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'old_values' => $oldValues ?: null,
            'new_values' => $newValues ?: null,
            'hash' => hash('sha256', json_encode($payload)),
            'notes' => $notes,
        ]);
    }

    public function applyConfidentialityFilter($query, User $user): void
    {
        if ($this->canSeeConfidential($user)) {
            return;
        }

        $query->where(function ($q) use ($user) {
            $q->where('is_confidential', false)
                ->orWhere('created_by', $user->id)
                ->orWhere('owner_id', $user->id);
        });
    }

    public function canSeeConfidential(User $user): bool
    {
        return $user->hasAnyRole(['System Admin', 'super-admin', 'Secretary General', 'Governance Officer', 'Director'])
            || $user->can('decisions.confidential')
            || $user->can('decisions.admin');
    }

    public function canAdopt(User $user): bool
    {
        return $user->can('decisions.adopt')
            || $user->can('decisions.admin')
            || $user->hasAnyRole(['System Admin', 'super-admin', 'Secretary General', 'Governance Officer', 'Director']);
    }

    public function canBypassAdoptionSoD(User $user): bool
    {
        return $user->can('decisions.admin')
            || $user->hasAnyRole(['System Admin', 'super-admin', 'Secretary General']);
    }

    public function isAdmin(User $user): bool
    {
        return $user->can('decisions.admin')
            || $user->hasAnyRole(['System Admin', 'super-admin']);
    }

    private function assertTenant(MeetingDecision $decision, User $user): void
    {
        abort_if((int) $decision->tenant_id !== (int) $user->tenant_id, 403);
    }

    private function assertCanView(MeetingDecision $decision, User $user): void
    {
        if ($decision->is_confidential && ! $this->canSeeConfidential($user)
            && (int) $decision->created_by !== (int) $user->id
            && (int) $decision->owner_id !== (int) $user->id) {
            abort(403, 'Confidential decision.');
        }
    }

    private function assertCanCreate(User $user): void
    {
        if ($user->can('decisions.create')
            || $user->can('decisions.admin')
            || $user->can('governance.create')
            || $user->hasAnyRole(['System Admin', 'super-admin', 'Governance Officer', 'staff', 'Director', 'Secretary General'])) {
            return;
        }
        abort(403, 'You cannot create decisions.');
    }

    private function assertCanManage(MeetingDecision $decision, User $user): void
    {
        if ($this->isAdmin($user)
            || $user->can('decisions.manage')
            || (int) $decision->created_by === (int) $user->id
            || (int) $decision->owner_id === (int) $user->id
            || $user->hasAnyRole(['Governance Officer', 'Secretary General', 'Director'])) {
            return;
        }
        abort(403, 'You cannot manage this decision.');
    }

    private function visibleTitle(MeetingDecision $decision, User $recipient): string
    {
        if ($decision->is_confidential && ! $this->canSeeConfidential($recipient)
            && (int) $decision->owner_id !== (int) $recipient->id
            && (int) $decision->created_by !== (int) $recipient->id) {
            return '[Confidential]';
        }

        return $decision->title;
    }
}
