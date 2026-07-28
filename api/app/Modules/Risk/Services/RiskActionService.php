<?php

namespace App\Modules\Risk\Services;

use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\Risk;
use App\Models\RiskAction;
use App\Models\RiskHistory;
use App\Models\User;
use App\Modules\Assignments\Services\AssignmentService;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class RiskActionService
{
    public function __construct(
        private readonly AssignmentService $assignments,
    ) {}

    public function list(Risk $risk, User $user): Collection
    {
        return $risk->actions()->with(['creator', 'owner', 'assignment'])->get();
    }

    public function create(Risk $risk, array $data, User $user, bool $createAssignment = true): RiskAction
    {
        $action = $risk->actions()->create([
            'tenant_id' => $risk->tenant_id,
            'risk_id' => $risk->id,
            'created_by' => $user->id,
            'owner_id' => $data['owner_id'] ?? $risk->action_owner_id,
            'description' => $data['description'],
            'action_plan' => $data['action_plan'] ?? null,
            'treatment_type' => $data['treatment_type'] ?? 'mitigate',
            'due_date' => $data['due_date'] ?? null,
            'status' => 'planned',
            'progress' => 0,
            'notes' => $data['notes'] ?? null,
        ]);

        if ($createAssignment && ($data['create_assignment'] ?? true)) {
            $assignment = $this->createAssignmentForAction($action, $user, $data);
            $action->update(['assignment_id' => $assignment->id]);
        }

        $this->recordRiskHistory($risk, 'action_added', $user, $risk->status, $risk->status, [], [
            'action_id' => $action->id,
            'description' => $action->description,
            'assignment_id' => $action->assignment_id,
        ]);

        AuditLog::record('risk.action_added', [
            'auditable_type' => Risk::class,
            'auditable_id' => $risk->id,
            'new_values' => ['action_id' => $action->id, 'assignment_id' => $action->assignment_id],
            'tags' => 'risk',
        ]);

        return $action->load(['creator', 'owner', 'assignment']);
    }

    public function createAssignmentForAction(RiskAction $action, User $user, array $data = []): Assignment
    {
        $action->loadMissing('risk');

        return $this->assignments->createFromSource([
            'source_type' => 'risk',
            'source_id' => $action->id,
            'source_purpose' => 'treatment_action',
            'source_reference' => $action->risk->risk_code,
            'source_title' => $action->risk->title,
            'title' => $data['assignment_title'] ?? ('Treat risk: '.$action->description),
            'description' => $data['assignment_description'] ?? ($action->action_plan ?: $action->description),
            'assigned_to' => $data['assigned_to'] ?? $action->owner_id,
            'department_id' => $action->risk->department_id,
            'due_date' => $action->due_date?->toDateString() ?? now()->addDays(14)->toDateString(),
            'priority' => in_array($action->risk->currentLevel(), ['high', 'critical'], true) ? 'high' : 'medium',
            'is_confidential' => (bool) $action->risk->is_confidential,
            'source_confidential' => (bool) $action->risk->is_confidential,
        ], $user);
    }

    public function update(RiskAction $action, array $data, User $user): RiskAction
    {
        $canEdit = (int) $action->created_by === (int) $user->id
            || (int) $action->owner_id === (int) $user->id
            || $user->hasAnyRole(['System Admin', 'super-admin']);

        if (! $canEdit) {
            abort(403, 'You are not allowed to edit this action.');
        }

        $fillable = array_filter([
            'description' => $data['description'] ?? null,
            'action_plan' => $data['action_plan'] ?? null,
            'treatment_type' => $data['treatment_type'] ?? null,
            'due_date' => $data['due_date'] ?? null,
            'status' => $data['status'] ?? null,
            'progress' => isset($data['progress']) ? (int) $data['progress'] : null,
            'owner_id' => $data['owner_id'] ?? null,
            'notes' => $data['notes'] ?? null,
        ], fn ($v) => $v !== null);

        $action->update($fillable);

        return $action->fresh(['creator', 'owner', 'assignment']);
    }

    public function markComplete(RiskAction $action, array $data, User $user): RiskAction
    {
        $action->update([
            'status' => 'completed',
            'completed_at' => now(),
            'progress' => 100,
            'notes' => $data['notes'] ?? $action->notes,
        ]);

        $risk = $action->risk;

        // Completing treatment Assignment/action ≠ automatic residual reduction.
        $risk->update(['residual_reassessment_required' => true]);

        $this->recordRiskHistory($risk, 'action_completed', $user, $risk->status, $risk->status, [], [
            'action_id' => $action->id,
            'description' => $action->description,
            'residual_reassessment_required' => true,
        ]);

        AuditLog::record('risk.action_completed', [
            'auditable_type' => Risk::class,
            'auditable_id' => $risk->id,
            'new_values' => ['action_id' => $action->id, 'residual_unchanged' => true],
            'tags' => 'risk',
        ]);

        return $action->fresh(['creator', 'owner', 'assignment']);
    }

    public function destroy(RiskAction $action, User $user): void
    {
        if ($action->isCompleted()) {
            throw ValidationException::withMessages(['status' => 'Completed actions cannot be deleted.']);
        }

        $risk = $action->risk;
        $action->delete();

        $this->recordRiskHistory($risk, 'action_removed', $user, $risk->status, $risk->status, [], [
            'action_id' => $action->id,
        ]);
    }

    private function recordRiskHistory(
        Risk $risk,
        string $changeType,
        User $actor,
        ?string $fromStatus,
        ?string $toStatus,
        array $oldValues = [],
        array $newValues = [],
        ?string $notes = null
    ): void {
        RiskHistory::create([
            'tenant_id' => $risk->tenant_id,
            'risk_id' => $risk->id,
            'actor_id' => $actor->id,
            'change_type' => $changeType,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'old_values' => $oldValues ?: null,
            'new_values' => $newValues ?: null,
            'hash' => hash('sha256', json_encode([$risk->id, $changeType, $actor->id, now()->toISOString()])),
            'notes' => $notes,
        ]);
    }
}
