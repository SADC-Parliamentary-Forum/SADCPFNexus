<?php

namespace App\Modules\Risk\Services;

use App\Models\AuditLog;
use App\Models\Risk;
use App\Models\RiskAction;
use App\Models\RiskHistory;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class RiskActionService
{
    public function list(Risk $risk, User $user): Collection
    {
        return $risk->actions()->with(['creator', 'owner'])->get();
    }

    public function create(Risk $risk, array $data, User $user): RiskAction
    {
        $action = $risk->actions()->create([
            'tenant_id'      => $risk->tenant_id,
            'risk_id'        => $risk->id,
            'created_by'     => $user->id,
            'owner_id'       => $data['owner_id'] ?? null,
            'description'    => $data['description'],
            'action_plan'    => $data['action_plan'] ?? null,
            'treatment_type' => $data['treatment_type'] ?? 'mitigate',
            'due_date'       => $data['due_date'] ?? null,
            'status'         => 'planned',
            'progress'       => 0,
            'notes'          => $data['notes'] ?? null,
        ]);

        // Record on the parent risk
        $this->recordRiskHistory($risk, 'action_added', $user, $risk->status, $risk->status, [], [
            'action_id'   => $action->id,
            'description' => $action->description,
        ]);

        AuditLog::record('risk.action_added', [
            'auditable_type' => Risk::class,
            'auditable_id'   => $risk->id,
            'new_values'     => ['action_id' => $action->id, 'description' => $action->description],
            'tags'           => 'risk',
        ]);

        return $action->load(['creator', 'owner']);
    }

    public function update(RiskAction $action, array $data, User $user): RiskAction
    {
        $canEdit = (int) $action->created_by === (int) $user->id
            || (int) $action->owner_id === (int) $user->id
            || $user->hasAnyRole(['System Admin', 'super-admin']);

        if (!$canEdit) {
            abort(403, 'You are not allowed to edit this action.');
        }

        $fillable = array_filter([
            'description'    => $data['description'] ?? null,
            'action_plan'    => $data['action_plan'] ?? null,
            'treatment_type' => $data['treatment_type'] ?? null,
            'due_date'       => $data['due_date'] ?? null,
            'status'         => $data['status'] ?? null,
            'progress'       => isset($data['progress']) ? (int) $data['progress'] : null,
            'owner_id'       => $data['owner_id'] ?? null,
            'notes'          => $data['notes'] ?? null,
        ], fn($v) => $v !== null);

        $action->update($fillable);

        return $action->fresh(['creator', 'owner']);
    }

    public function markComplete(RiskAction $action, array $data, User $user): RiskAction
    {
        $action->update([
            'status'       => 'completed',
            'completed_at' => now(),
            'progress'     => 100,
            'notes'        => $data['notes'] ?? $action->notes,
        ]);

        $risk = $action->risk;

        $this->recordRiskHistory($risk, 'action_completed', $user, $risk->status, $risk->status, [], [
            'action_id'   => $action->id,
            'description' => $action->description,
        ]);

        AuditLog::record('risk.action_completed', [
            'auditable_type' => Risk::class,
            'auditable_id'   => $risk->id,
            'new_values'     => ['action_id' => $action->id],
            'tags'           => 'risk',
        ]);

        return $action->fresh(['creator', 'owner']);
    }

    public function delete(RiskAction $action, User $user): void
    {
        if ($action->status !== 'planned') {
            throw ValidationException::withMessages(['status' => 'Only planned actions can be deleted.']);
        }

        $canDelete = (int) $action->created_by === (int) $user->id
            || $user->hasAnyRole(['System Admin', 'super-admin']);

        if (!$canDelete) {
            abort(403, 'You are not allowed to delete this action.');
        }

        $action->delete();
    }

    private function recordRiskHistory(
        Risk    $risk,
        string  $changeType,
        User    $actor,
        ?string $fromStatus,
        ?string $toStatus,
        array   $oldValues = [],
        array   $newValues = [],
        ?string $notes = null
    ): RiskHistory {
        $hash = hash('sha256', json_encode([
            'risk_id' => $risk->id,
            'type'    => $changeType,
            'actor'   => $actor->id,
            'ts'      => now()->toISOString(),
        ]));

        return RiskHistory::create([
            'tenant_id'   => $risk->tenant_id,
            'risk_id'     => $risk->id,
            'actor_id'    => $actor->id,
            'change_type' => $changeType,
            'from_status' => $fromStatus,
            'to_status'   => $toStatus,
            'old_values'  => $oldValues ?: null,
            'new_values'  => $newValues ?: null,
            'hash'        => $hash,
            'notes'       => $notes,
        ]);
    }
}
