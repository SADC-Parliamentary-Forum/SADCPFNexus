<?php

namespace App\Modules\Risk\Services;

use App\Models\AuditLog;
use App\Models\Risk;
use App\Models\RiskHistory;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Validation\ValidationException;

class RiskService
{
    // ── List ──────────────────────────────────────────────────────────────────

    public function list(array $filters, User $user): LengthAwarePaginator
    {
        $query = Risk::with(['submitter', 'riskOwner', 'actionOwner', 'department'])
            ->where('tenant_id', $user->tenant_id)
            ->orderByDesc('created_at');

        // Staff sees only their own risks (submitted_by or risk_owner)
        if ($user->hasRole('staff') && !$user->hasAnyRole([
            'HOD', 'Director', 'Governance Officer', 'Secretary General',
            'Internal Auditor', 'Committee Member', 'System Admin', 'super-admin',
        ])) {
            $query->where(function ($q) use ($user) {
                $q->where('submitted_by', $user->id)
                  ->orWhere('risk_owner_id', $user->id);
            });
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['category'])) {
            $query->where('category', $filters['category']);
        }

        if (!empty($filters['risk_level'])) {
            $query->where('risk_level', $filters['risk_level']);
        }

        if (!empty($filters['search'])) {
            $query->where(function ($q) use ($filters) {
                $q->where('title', 'ilike', "%{$filters['search']}%")
                  ->orWhere('description', 'ilike', "%{$filters['search']}%")
                  ->orWhere('risk_code', 'ilike', "%{$filters['search']}%");
            });
        }

        return $query->paginate($filters['per_page'] ?? 20);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    public function create(array $data, User $user): Risk
    {
        $risk = Risk::create([
            'tenant_id'           => $user->tenant_id,
            'submitted_by'        => $user->id,
            'title'               => $data['title'],
            'description'         => $data['description'],
            'category'            => $data['category'],
            'likelihood'          => $data['likelihood'],
            'impact'              => $data['impact'],
            'department_id'       => $data['department_id'] ?? null,
            'risk_owner_id'       => $data['risk_owner_id'] ?? null,
            'action_owner_id'     => $data['action_owner_id'] ?? null,
            'control_effectiveness' => $data['control_effectiveness'] ?? 'none',
            'review_frequency'    => $data['review_frequency'] ?? null,
            'next_review_date'    => $data['next_review_date'] ?? null,
            'status'              => 'draft',
            'escalation_level'    => 'none',
        ]);

        $this->recordHistory($risk, 'created', $user, null, 'draft', [], [
            'title'    => $risk->title,
            'category' => $risk->category,
        ]);

        AuditLog::record('risk.created', [
            'auditable_type' => Risk::class,
            'auditable_id'   => $risk->id,
            'new_values'     => ['risk_code' => $risk->risk_code, 'title' => $risk->title],
            'tags'           => 'risk',
        ]);

        return $risk->load(['submitter', 'riskOwner', 'actionOwner', 'department']);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public function update(Risk $risk, array $data, User $user): Risk
    {
        if (!$risk->isEditable()) {
            throw ValidationException::withMessages(['status' => 'Only draft or submitted risks can be edited.']);
        }

        // Only submitter, risk_owner, or admin can edit
        $canEdit = (int) $risk->submitted_by === (int) $user->id
            || (int) $risk->risk_owner_id === (int) $user->id
            || $user->hasAnyRole(['System Admin', 'super-admin']);

        if (!$canEdit) {
            abort(403, 'You are not allowed to edit this risk.');
        }

        $oldValues = $risk->only(['title', 'description', 'category', 'likelihood', 'impact']);

        $fillable = array_filter([
            'title'               => $data['title'] ?? null,
            'description'         => $data['description'] ?? null,
            'category'            => $data['category'] ?? null,
            'likelihood'          => $data['likelihood'] ?? null,
            'impact'              => $data['impact'] ?? null,
            'department_id'       => $data['department_id'] ?? null,
            'risk_owner_id'       => $data['risk_owner_id'] ?? null,
            'action_owner_id'     => $data['action_owner_id'] ?? null,
            'control_effectiveness' => $data['control_effectiveness'] ?? null,
            'review_frequency'    => $data['review_frequency'] ?? null,
            'next_review_date'    => $data['next_review_date'] ?? null,
            'review_notes'        => $data['review_notes'] ?? null,
            'residual_likelihood' => $data['residual_likelihood'] ?? null,
            'residual_impact'     => $data['residual_impact'] ?? null,
        ], fn($v) => $v !== null);

        $risk->update($fillable);

        $this->recordHistory($risk, 'updated', $user, $risk->status, $risk->status, $oldValues, $fillable);

        AuditLog::record('risk.updated', [
            'auditable_type' => Risk::class,
            'auditable_id'   => $risk->id,
            'tags'           => 'risk',
        ]);

        return $risk->fresh(['submitter', 'riskOwner', 'actionOwner', 'department']);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    public function delete(Risk $risk, User $user): void
    {
        if (!$risk->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft risks can be deleted.']);
        }

        $canDelete = (int) $risk->submitted_by === (int) $user->id
            || $user->hasAnyRole(['System Admin', 'super-admin']);

        if (!$canDelete) {
            abort(403, 'You are not allowed to delete this risk.');
        }

        AuditLog::record('risk.deleted', [
            'auditable_type' => Risk::class,
            'auditable_id'   => $risk->id,
            'old_values'     => ['risk_code' => $risk->risk_code, 'title' => $risk->title],
            'tags'           => 'risk',
        ]);

        $risk->delete();
    }

    // ── Submit ────────────────────────────────────────────────────────────────

    public function submit(Risk $risk, User $user): Risk
    {
        if (!$risk->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft risks can be submitted.']);
        }

        $risk->update(['status' => 'submitted', 'submitted_at' => now()]);

        $this->recordHistory($risk, 'submitted', $user, 'draft', 'submitted');

        AuditLog::record('risk.submitted', [
            'auditable_type' => Risk::class,
            'auditable_id'   => $risk->id,
            'tags'           => 'risk',
        ]);

        return $risk->fresh();
    }

    // ── Start Review ──────────────────────────────────────────────────────────

    public function startReview(Risk $risk, User $reviewer): Risk
    {
        if (!$risk->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted risks can be reviewed.']);
        }

        $risk->update([
            'status'      => 'reviewed',
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
        ]);

        $this->recordHistory($risk, 'reviewed', $reviewer, 'submitted', 'reviewed');

        AuditLog::record('risk.reviewed', [
            'auditable_type' => Risk::class,
            'auditable_id'   => $risk->id,
            'new_values'     => ['reviewed_by' => $reviewer->id],
            'tags'           => 'risk',
        ]);

        return $risk->fresh();
    }

    // ── Approve ───────────────────────────────────────────────────────────────

    public function approve(Risk $risk, array $data, User $approver): Risk
    {
        if (!$risk->isReviewed()) {
            throw ValidationException::withMessages(['status' => 'Only reviewed risks can be approved.']);
        }

        $updateData = [
            'status'      => 'approved',
            'approved_by' => $approver->id,
            'approved_at' => now(),
        ];

        if (!empty($data['review_notes'])) {
            $updateData['review_notes'] = $data['review_notes'];
        }

        $risk->update($updateData);

        $this->recordHistory($risk, 'approved', $approver, 'reviewed', 'approved', [], $updateData);

        AuditLog::record('risk.approved', [
            'auditable_type' => Risk::class,
            'auditable_id'   => $risk->id,
            'new_values'     => ['approved_by' => $approver->id],
            'tags'           => 'risk',
        ]);

        return $risk->fresh();
    }

    // ── Escalate ──────────────────────────────────────────────────────────────

    public function escalate(Risk $risk, array $data, User $actor): Risk
    {
        $forbiddenStatuses = ['draft', 'closed', 'archived'];
        if (in_array($risk->status, $forbiddenStatuses, true)) {
            throw ValidationException::withMessages(['status' => 'Risk cannot be escalated from its current status.']);
        }

        $fromStatus = $risk->status;

        $risk->update([
            'status'           => 'escalated',
            'escalation_level' => $data['escalation_level'],
        ]);

        $this->recordHistory($risk, 'escalated', $actor, $fromStatus, 'escalated', [], [
            'escalation_level' => $data['escalation_level'],
        ], $data['notes'] ?? null);

        AuditLog::record('risk.escalated', [
            'auditable_type' => Risk::class,
            'auditable_id'   => $risk->id,
            'new_values'     => ['escalation_level' => $data['escalation_level']],
            'tags'           => 'risk',
        ]);

        return $risk->fresh();
    }

    // ── Close ─────────────────────────────────────────────────────────────────

    public function close(Risk $risk, array $data, User $actor): Risk
    {
        $allowedStatuses = ['approved', 'monitoring', 'escalated'];
        if (!in_array($risk->status, $allowedStatuses, true)) {
            throw ValidationException::withMessages(['status' => 'Risk cannot be closed from its current status.']);
        }

        $fromStatus = $risk->status;

        $risk->update([
            'status'           => 'closed',
            'closure_evidence' => $data['closure_evidence'],
            'closed_by'        => $actor->id,
            'closed_at'        => now(),
        ]);

        $this->recordHistory($risk, 'closed', $actor, $fromStatus, 'closed', [], [
            'closure_evidence' => $data['closure_evidence'],
        ], $data['notes'] ?? null);

        AuditLog::record('risk.closed', [
            'auditable_type' => Risk::class,
            'auditable_id'   => $risk->id,
            'tags'           => 'risk',
        ]);

        return $risk->fresh();
    }

    // ── Archive ───────────────────────────────────────────────────────────────

    public function archive(Risk $risk, User $actor): Risk
    {
        if (!$risk->isClosed()) {
            throw ValidationException::withMessages(['status' => 'Only closed risks can be archived.']);
        }

        $risk->update(['status' => 'archived']);

        $this->recordHistory($risk, 'archived', $actor, 'closed', 'archived');

        AuditLog::record('risk.archived', [
            'auditable_type' => Risk::class,
            'auditable_id'   => $risk->id,
            'tags'           => 'risk',
        ]);

        return $risk->fresh();
    }

    // ── Reopen ────────────────────────────────────────────────────────────────

    public function reopen(Risk $risk, User $actor): Risk
    {
        if (!$risk->isClosed() && !$risk->isArchived()) {
            throw ValidationException::withMessages(['status' => 'Only closed or archived risks can be reopened.']);
        }

        $fromStatus = $risk->status;

        $risk->update(['status' => 'submitted']);

        $this->recordHistory($risk, 'submitted', $actor, $fromStatus, 'submitted');

        AuditLog::record('risk.reopened', [
            'auditable_type' => Risk::class,
            'auditable_id'   => $risk->id,
            'tags'           => 'risk',
        ]);

        return $risk->fresh();
    }

    // ── Private helper ────────────────────────────────────────────────────────

    private function recordHistory(
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
