<?php

namespace App\Modules\Risk\Services;

use App\Models\AuditLog;
use App\Models\Risk;
use App\Models\RiskHistory;
use App\Models\RiskIncident;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Validation\ValidationException;

class RiskService
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly RiskAssessmentService $assessments,
        private readonly RiskAppetiteService $appetite,
    ) {}
    // ── List ──────────────────────────────────────────────────────────────────

    public function list(array $filters, User $user): LengthAwarePaginator
    {
        $query = Risk::with(['submitter', 'riskOwner', 'actionOwner', 'controlOwner', 'department', 'strategicObjective'])
            ->where('tenant_id', $user->tenant_id)
            ->orderByDesc('created_at');

        $this->applyConfidentialityFilter($query, $user);

        if ($user->hasRole('staff') && ! $user->hasAnyRole([
            'HOD', 'Director', 'Governance Officer', 'Secretary General',
            'Internal Auditor', 'Committee Member', 'System Admin', 'super-admin',
        ])) {
            $query->where(function ($q) use ($user) {
                $q->where('submitted_by', $user->id)
                    ->orWhere('risk_owner_id', $user->id)
                    ->orWhere('control_owner_id', $user->id)
                    ->orWhere('action_owner_id', $user->id);
            });
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['category'])) {
            $query->where('category', $filters['category']);
        }
        if (! empty($filters['risk_level'])) {
            $query->where('risk_level', $filters['risk_level']);
        }
        if (! empty($filters['register_scope'])) {
            $query->where('register_scope', $filters['register_scope']);
        }
        if (! empty($filters['department_id'])) {
            $query->where('department_id', $filters['department_id']);
        }
        if (! empty($filters['search'])) {
            $term = $filters['search'];
            $query->where(function ($q) use ($term) {
                $q->where('title', 'ilike', "%{$term}%")
                    ->orWhere('description', 'ilike', "%{$term}%")
                    ->orWhere('risk_code', 'ilike', "%{$term}%");
            });
        }

        return $query->paginate($filters['per_page'] ?? 20);
    }

    public function applyConfidentialityFilter($query, User $user): void
    {
        if ($this->canSeeConfidential($user)) {
            return;
        }

        $query->where(function ($q) use ($user) {
            $q->where('is_confidential', false)
                ->orWhere('submitted_by', $user->id)
                ->orWhere('risk_owner_id', $user->id)
                ->orWhere('control_owner_id', $user->id);
        });
    }

    public function canSeeConfidential(User $user): bool
    {
        return $user->hasAnyRole([
            'Governance Officer', 'Secretary General', 'Director',
            'Internal Auditor', 'System Admin', 'super-admin',
        ]) || $user->can('risk.confidential') || $user->can('risk.admin');
    }

    // ── Create ────────────────────────────────────────────────────────────────

    public function create(array $data, User $user): Risk
    {
        $this->assertValidOwners($data, $user);

        $status = ($data['as_proposal'] ?? false) ? 'proposed' : 'draft';

        $risk = Risk::create([
            'tenant_id' => $user->tenant_id,
            'submitted_by' => $user->id,
            'title' => $data['title'],
            'description' => $data['description'],
            'category' => $data['category'],
            'register_scope' => $data['register_scope'] ?? 'department',
            'project_id' => $data['project_id'] ?? null,
            'department_id' => $data['department_id'] ?? null,
            'strategic_objective_id' => $data['strategic_objective_id'] ?? null,
            'cause' => $data['cause'] ?? null,
            'event_description' => $data['event_description'] ?? null,
            'consequence' => $data['consequence'] ?? null,
            'likelihood' => $data['likelihood'],
            'impact' => $data['impact'],
            'risk_owner_id' => $data['risk_owner_id'] ?? null,
            'action_owner_id' => $data['action_owner_id'] ?? null,
            'control_owner_id' => $data['control_owner_id'] ?? null,
            'is_confidential' => (bool) ($data['is_confidential'] ?? false),
            'control_effectiveness' => $data['control_effectiveness'] ?? 'none',
            'treatment_strategy' => $data['treatment_strategy'] ?? null,
            'review_frequency' => $data['review_frequency'] ?? null,
            'next_review_date' => $data['next_review_date'] ?? null,
            'source_type' => $data['source_type'] ?? null,
            'source_id' => $data['source_id'] ?? null,
            'source_purpose' => $data['source_purpose'] ?? null,
            'status' => $status,
            'escalation_level' => 'none',
        ]);

        // Initial inherent assessment history
        $this->assessments->record($risk, [
            'assessment_type' => 'inherent',
            'likelihood' => $data['likelihood'],
            'impact' => $data['impact'],
            'rationale' => $data['inherent_rationale'] ?? 'Initial inherent assessment',
        ], $user);

        $this->recordHistory($risk, 'created', $user, null, $status, [], [
            'title' => $risk->title,
            'category' => $risk->category,
        ]);

        AuditLog::record('risk.created', [
            'auditable_type' => Risk::class,
            'auditable_id' => $risk->id,
            'new_values' => ['risk_code' => $risk->risk_code, 'title' => $risk->title],
            'tags' => 'risk',
        ]);

        return $risk->load(['submitter', 'riskOwner', 'actionOwner', 'controlOwner', 'department', 'strategicObjective']);
    }

    public function createFromWeeklyRisk(\App\Models\WeeklyReportRisk $weeklyRisk, User $user, array $data = []): Risk
    {
        $report = $weeklyRisk->report;

        return $this->create([
            'title' => $data['title'] ?? ('Weekly emerging risk: '.$weeklyRisk->emerging_issue),
            'description' => $data['description'] ?? ($weeklyRisk->possible_impact ?: $weeklyRisk->emerging_issue),
            'category' => $data['category'] ?? 'operational',
            'likelihood' => (int) ($data['likelihood'] ?? 3),
            'impact' => (int) ($data['impact'] ?? 3),
            'department_id' => $report->department_id,
            'strategic_objective_id' => $data['strategic_objective_id'] ?? null,
            'risk_owner_id' => $data['risk_owner_id'] ?? $user->id,
            'cause' => $data['cause'] ?? null,
            'event_description' => $weeklyRisk->emerging_issue,
            'consequence' => $weeklyRisk->possible_impact,
            'is_confidential' => ($weeklyRisk->confidentiality ?? 'internal') === 'confidential',
            'source_type' => 'weekly_summary',
            'source_id' => $weeklyRisk->id,
            'source_purpose' => 'weekly_emerging_risk',
            'as_proposal' => true,
        ], $user);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public function update(Risk $risk, array $data, User $user): Risk
    {
        if (! $risk->isEditable()) {
            throw ValidationException::withMessages(['status' => 'Only draft or proposed risks can be edited.']);
        }

        $canEdit = (int) $risk->submitted_by === (int) $user->id
            || (int) $risk->risk_owner_id === (int) $user->id
            || $user->hasAnyRole(['System Admin', 'super-admin', 'Governance Officer']);

        if (! $canEdit) {
            abort(403, 'You are not allowed to edit this risk.');
        }

        $this->assertValidOwners($data, $user, $risk);

        // Residual updates must go through RiskAssessmentService — reject formula shortcuts here.
        if (array_key_exists('control_reduction_pct', $data) || array_key_exists('controls_reduce_percent', $data)) {
            throw ValidationException::withMessages([
                'residual' => 'Residual risk must be assessed explicitly. Arbitrary control-reduction percentage formulas are not allowed.',
            ]);
        }

        $oldValues = $risk->only(['title', 'description', 'category', 'likelihood', 'impact']);

        $fillable = array_filter([
            'title' => $data['title'] ?? null,
            'description' => $data['description'] ?? null,
            'category' => $data['category'] ?? null,
            'register_scope' => $data['register_scope'] ?? null,
            'project_id' => $data['project_id'] ?? null,
            'department_id' => $data['department_id'] ?? null,
            'strategic_objective_id' => $data['strategic_objective_id'] ?? null,
            'cause' => $data['cause'] ?? null,
            'event_description' => $data['event_description'] ?? null,
            'consequence' => $data['consequence'] ?? null,
            'likelihood' => $data['likelihood'] ?? null,
            'impact' => $data['impact'] ?? null,
            'risk_owner_id' => $data['risk_owner_id'] ?? null,
            'action_owner_id' => $data['action_owner_id'] ?? null,
            'control_owner_id' => $data['control_owner_id'] ?? null,
            'is_confidential' => array_key_exists('is_confidential', $data) ? (bool) $data['is_confidential'] : null,
            'control_effectiveness' => $data['control_effectiveness'] ?? null,
            'treatment_strategy' => $data['treatment_strategy'] ?? null,
            'review_frequency' => $data['review_frequency'] ?? null,
            'next_review_date' => $data['next_review_date'] ?? null,
            'review_notes' => $data['review_notes'] ?? null,
        ], fn ($v) => $v !== null);

        $risk->update($fillable);

        if (isset($data['likelihood']) || isset($data['impact'])) {
            $this->assessments->record($risk, [
                'assessment_type' => 'inherent',
                'likelihood' => $risk->likelihood,
                'impact' => $risk->impact,
                'rationale' => $data['inherent_rationale'] ?? 'Updated inherent assessment',
            ], $user);
        }

        // Explicit residual only via assessments endpoint — but allow legacy residual_* if provided without formula
        if (isset($data['residual_likelihood'], $data['residual_impact'])) {
            $this->assessments->record($risk, [
                'assessment_type' => 'residual',
                'likelihood' => $data['residual_likelihood'],
                'impact' => $data['residual_impact'],
                'rationale' => $data['residual_rationale'] ?? 'Residual assessment',
            ], $user);
        }

        $this->recordHistory($risk, 'updated', $user, $risk->status, $risk->status, $oldValues, $fillable);

        AuditLog::record('risk.updated', [
            'auditable_type' => Risk::class,
            'auditable_id' => $risk->id,
            'tags' => 'risk',
        ]);

        return $risk->fresh(['submitter', 'riskOwner', 'actionOwner', 'controlOwner', 'department', 'strategicObjective']);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    public function delete(Risk $risk, User $user): void
    {
        if ($risk->isClosed() || $risk->isArchived()) {
            throw ValidationException::withMessages([
                'status' => 'Closed or archived risks cannot be deleted. They remain in the institutional record.',
            ]);
        }

        if (! $risk->isDraft() && ! $risk->isProposed()) {
            throw ValidationException::withMessages(['status' => 'Only draft or proposed risks can be deleted.']);
        }

        $canDelete = (int) $risk->submitted_by === (int) $user->id
            || $user->hasAnyRole(['System Admin', 'super-admin']);

        if (! $canDelete) {
            abort(403, 'You are not allowed to delete this risk.');
        }

        AuditLog::record('risk.deleted', [
            'auditable_type' => Risk::class,
            'auditable_id' => $risk->id,
            'old_values' => ['risk_code' => $risk->risk_code, 'title' => $risk->title],
            'tags' => 'risk',
        ]);

        $risk->delete(); // soft delete only
    }

    public function forceDeleteBlocked(Risk $risk): never
    {
        throw ValidationException::withMessages([
            'status' => 'Hard-delete of risk records is not permitted.',
        ]);
    }

    // ── Submit ────────────────────────────────────────────────────────────────

    public function submit(Risk $risk, User $user): Risk
    {
        if (! $risk->isDraft() && ! $risk->isProposed()) {
            throw ValidationException::withMessages(['status' => 'Only draft or proposed risks can be submitted.']);
        }

        $this->assertReadyForRegister($risk);

        $from = $risk->status;
        $risk->update(['status' => 'submitted', 'submitted_at' => now()]);

        $this->recordHistory($risk, 'submitted', $user, $from, 'submitted');

        AuditLog::record('risk.submitted', [
            'auditable_type' => Risk::class,
            'auditable_id' => $risk->id,
            'tags' => 'risk',
        ]);

        $reviewers = User::role(['Governance Officer', 'Internal Auditor', 'Director'])
            ->where('tenant_id', $user->tenant_id)
            ->where('id', '!=', $user->id)
            ->get();

        foreach ($reviewers as $reviewer) {
            if ($risk->is_confidential && ! $this->canSeeConfidential($reviewer)
                && (int) $reviewer->id !== (int) $risk->risk_owner_id) {
                continue;
            }
            $this->notifications->dispatch($reviewer, 'risk.submitted', [
                'name' => $reviewer->name,
                'risk_code' => $risk->is_confidential ? '[Confidential]' : ($risk->risk_code ?? "#{$risk->id}"),
                'title' => $risk->is_confidential ? 'Confidential risk submitted' : $risk->title,
                'category' => ucfirst($risk->category ?? ''),
                'level' => strtoupper($risk->risk_level ?? ''),
                'submitter' => $user->name,
            ], ['module' => 'risk', 'record_id' => $risk->id, 'url' => '/risk/'.$risk->id], false);
        }

        return $risk->fresh();
    }

    public function acceptProposal(Risk $risk, User $user): Risk
    {
        if (! $risk->isProposed()) {
            throw ValidationException::withMessages(['status' => 'Only proposed risks can be accepted into the register.']);
        }

        $this->assertReadyForRegister($risk);
        $risk->update(['status' => 'draft']);
        $this->recordHistory($risk, 'proposal_accepted', $user, 'proposed', 'draft');

        return $risk->fresh();
    }

    public function rejectProposal(Risk $risk, User $user, ?string $notes = null): Risk
    {
        if (! $risk->isProposed()) {
            throw ValidationException::withMessages(['status' => 'Only proposed risks can be rejected.']);
        }

        $risk->update(['status' => 'closed', 'closure_evidence' => $notes ?? 'Proposal rejected', 'closed_by' => $user->id, 'closed_at' => now()]);
        $this->recordHistory($risk, 'proposal_rejected', $user, 'proposed', 'closed', [], [], $notes);

        return $risk->fresh();
    }

    // ── Start Review ──────────────────────────────────────────────────────────

    public function startReview(Risk $risk, User $reviewer): Risk
    {
        if (! $risk->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted risks can be reviewed.']);
        }

        $risk->update([
            'status' => 'reviewed',
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
        ]);

        $this->recordHistory($risk, 'reviewed', $reviewer, 'submitted', 'reviewed');

        AuditLog::record('risk.reviewed', [
            'auditable_type' => Risk::class,
            'auditable_id' => $risk->id,
            'new_values' => ['reviewed_by' => $reviewer->id],
            'tags' => 'risk',
        ]);

        return $risk->fresh();
    }

    // ── Approve ───────────────────────────────────────────────────────────────

    public function approve(Risk $risk, array $data, User $approver): Risk
    {
        if (! $risk->isReviewed()) {
            throw ValidationException::withMessages(['status' => 'Only reviewed risks can be approved.']);
        }

        $updateData = [
            'status' => 'approved',
            'approved_by' => $approver->id,
            'approved_at' => now(),
        ];

        if (! empty($data['review_notes'])) {
            $updateData['review_notes'] = $data['review_notes'];
        }

        $risk->update($updateData);

        $this->recordHistory($risk, 'approved', $approver, 'reviewed', 'approved', [], $updateData);

        AuditLog::record('risk.approved', [
            'auditable_type' => Risk::class,
            'auditable_id' => $risk->id,
            'new_values' => ['approved_by' => $approver->id],
            'tags' => 'risk',
        ]);

        $risk->loadMissing(['submitter', 'riskOwner']);
        $notified = [];
        foreach (array_filter([$risk->submitter, $risk->riskOwner]) as $recipient) {
            if (in_array($recipient->id, $notified) || (int) $recipient->id === (int) $approver->id) {
                continue;
            }
            $notified[] = $recipient->id;
            $this->notifications->dispatch($recipient, 'risk.approved', [
                'name' => $recipient->name,
                'risk_code' => $risk->is_confidential ? '[Confidential]' : ($risk->risk_code ?? "#{$risk->id}"),
                'title' => $risk->is_confidential ? 'Confidential risk approved' : $risk->title,
                'approved_by' => $approver->name,
            ], ['module' => 'risk', 'record_id' => $risk->id, 'url' => '/risk/'.$risk->id], false);
        }

        return $risk->fresh();
    }

    // ── Escalate ──────────────────────────────────────────────────────────────

    public function escalate(Risk $risk, array $data, User $actor): Risk
    {
        $forbiddenStatuses = ['draft', 'proposed', 'closed', 'archived'];
        if (in_array($risk->status, $forbiddenStatuses, true)) {
            throw ValidationException::withMessages(['status' => 'Risk cannot be escalated from its current status.']);
        }

        $fromStatus = $risk->status;

        $risk->update([
            'status' => 'escalated',
            'escalation_level' => $data['escalation_level'],
        ]);

        $this->recordHistory($risk, 'escalated', $actor, $fromStatus, 'escalated', [], [
            'escalation_level' => $data['escalation_level'],
        ], $data['notes'] ?? null);

        AuditLog::record('risk.escalated', [
            'auditable_type' => Risk::class,
            'auditable_id' => $risk->id,
            'new_values' => ['escalation_level' => $data['escalation_level']],
            'tags' => 'risk',
        ]);

        $seniors = User::role(['Secretary General', 'Director'])
            ->where('tenant_id', $risk->tenant_id)
            ->where('id', '!=', $actor->id)
            ->get();
        foreach ($seniors as $senior) {
            if ($risk->is_confidential && ! $this->canSeeConfidential($senior)) {
                continue;
            }
            $this->notifications->dispatch($senior, 'risk.escalated', [
                'name' => $senior->name,
                'risk_code' => $risk->is_confidential ? '[Confidential]' : ($risk->risk_code ?? "#{$risk->id}"),
                'title' => $risk->is_confidential ? 'Confidential risk escalated' : $risk->title,
                'level' => strtoupper($data['escalation_level']),
                'actor' => $actor->name,
                'notes' => $data['notes'] ?? '',
            ], ['module' => 'risk', 'record_id' => $risk->id, 'url' => '/risk/'.$risk->id], false);
        }

        return $risk->fresh();
    }

    // ── Materialise ───────────────────────────────────────────────────────────

    public function materialise(Risk $risk, array $data, User $actor): Risk
    {
        $allowed = ['approved', 'monitoring', 'escalated'];
        if (! in_array($risk->status, $allowed, true)) {
            throw ValidationException::withMessages(['status' => 'Only approved/monitoring/escalated risks can be materialised.']);
        }

        $incident = null;
        if (! empty($data['create_incident'])) {
            $incident = RiskIncident::create([
                'tenant_id' => $risk->tenant_id,
                'title' => $data['incident_title'] ?? ('Materialised: '.$risk->title),
                'description' => $data['incident_description'] ?? ($data['notes'] ?? $risk->consequence ?? $risk->description),
                'risk_id' => $risk->id,
                'severity' => $data['severity'] ?? $risk->currentLevel(),
                'status' => 'open',
                'occurred_at' => $data['occurred_at'] ?? now(),
                'reported_by' => $actor->id,
                'department_id' => $risk->department_id,
                'is_confidential' => $risk->is_confidential,
            ]);
        }

        // Materialised ≠ automatically closed
        $risk->update([
            'materialised_at' => now(),
            'materialisation_notes' => $data['notes'] ?? null,
            'linked_incident_id' => $incident?->id,
            'status' => $risk->status === 'approved' ? 'monitoring' : $risk->status,
        ]);

        $this->recordHistory($risk, 'materialised', $actor, $risk->status, $risk->status, [], [
            'incident_id' => $incident?->id,
        ], $data['notes'] ?? null);

        AuditLog::record('risk.materialised', [
            'auditable_type' => Risk::class,
            'auditable_id' => $risk->id,
            'new_values' => ['incident_id' => $incident?->id],
            'tags' => 'risk',
        ]);

        return $risk->fresh(['incidents']);
    }

    // ── Close ─────────────────────────────────────────────────────────────────

    public function close(Risk $risk, array $data, User $actor): Risk
    {
        $allowedStatuses = ['approved', 'monitoring', 'escalated'];
        if (! in_array($risk->status, $allowedStatuses, true)) {
            throw ValidationException::withMessages(['status' => 'Risk cannot be closed from its current status.']);
        }

        $fromStatus = $risk->status;

        $risk->update([
            'status' => 'closed',
            'closure_evidence' => $data['closure_evidence'],
            'closed_by' => $actor->id,
            'closed_at' => now(),
        ]);

        $this->recordHistory($risk, 'closed', $actor, $fromStatus, 'closed', [], [
            'closure_evidence' => $data['closure_evidence'],
        ], $data['notes'] ?? null);

        AuditLog::record('risk.closed', [
            'auditable_type' => Risk::class,
            'auditable_id' => $risk->id,
            'tags' => 'risk',
        ]);

        return $risk->fresh();
    }

    public function archive(Risk $risk, User $actor): Risk
    {
        if (! $risk->isClosed()) {
            throw ValidationException::withMessages(['status' => 'Only closed risks can be archived.']);
        }

        $risk->update(['status' => 'archived']);
        $this->recordHistory($risk, 'archived', $actor, 'closed', 'archived');

        AuditLog::record('risk.archived', [
            'auditable_type' => Risk::class,
            'auditable_id' => $risk->id,
            'tags' => 'risk',
        ]);

        return $risk->fresh();
    }

    public function reopen(Risk $risk, User $actor): Risk
    {
        if (! $risk->isClosed() && ! $risk->isArchived()) {
            throw ValidationException::withMessages(['status' => 'Only closed or archived risks can be reopened.']);
        }

        $fromStatus = $risk->status;
        $risk->update(['status' => 'submitted']);
        $this->recordHistory($risk, 'submitted', $actor, $fromStatus, 'submitted');

        AuditLog::record('risk.reopened', [
            'auditable_type' => Risk::class,
            'auditable_id' => $risk->id,
            'tags' => 'risk',
        ]);

        return $risk->fresh();
    }

    // ── Ownership rules ───────────────────────────────────────────────────────

    public function assertValidOwners(array $data, User $actor, ?Risk $existing = null): void
    {
        foreach (['risk_owner_id', 'control_owner_id'] as $field) {
            $id = $data[$field] ?? null;
            if (! $id) {
                continue;
            }
            $owner = User::find($id);
            if (! $owner) {
                throw ValidationException::withMessages([$field => 'User not found.']);
            }
            if ($owner->hasRole('Internal Auditor') && ! $owner->hasAnyRole(['System Admin', 'super-admin', 'Director', 'Governance Officer'])) {
                // Pure IA role cannot own management risks/controls
                $roles = $owner->getRoleNames()->all();
                if ($roles === ['Internal Auditor'] || (count($roles) === 1 && in_array('Internal Auditor', $roles, true))) {
                    throw ValidationException::withMessages([
                        $field => 'Internal Audit provides assurance and must not own management risks or controls.',
                    ]);
                }
                if ($owner->hasRole('Internal Auditor') && ! $owner->hasAnyRole(['HOD', 'Director', 'Governance Officer', 'Secretary General', 'staff'])) {
                    throw ValidationException::withMessages([
                        $field => 'Internal Audit provides assurance and must not own management risks or controls.',
                    ]);
                }
            }
            // Stricter: if the user's only elevated governance role is Internal Auditor
            if ($owner->hasRole('Internal Auditor')
                && ! $owner->hasAnyRole(['HOD', 'Director', 'Governance Officer', 'Secretary General', 'System Admin', 'super-admin'])) {
                // Allow if also staff (dual-hatted) — still block pure IA
                if (! $owner->hasRole('staff')) {
                    throw ValidationException::withMessages([
                        $field => 'Internal Audit provides assurance and must not own management risks or controls.',
                    ]);
                }
            }
        }

        // Simpler hard rule used by tests: reject when candidate has Internal Auditor and is being set as risk/control owner
        // unless they also have a management role.
        foreach (['risk_owner_id' => 'Risk Owner', 'control_owner_id' => 'Control Owner'] as $field => $label) {
            $id = $data[$field] ?? null;
            if (! $id) {
                continue;
            }
            $owner = User::find($id);
            if ($owner && $owner->hasRole('Internal Auditor')
                && ! $owner->hasAnyRole(['HOD', 'Director', 'Governance Officer', 'Secretary General', 'System Admin', 'super-admin'])) {
                throw ValidationException::withMessages([
                    $field => "Internal Audit cannot be assigned as {$label} on the management risk register.",
                ]);
            }
        }
    }

    public function assertReadyForRegister(Risk $risk): void
    {
        if (! $risk->strategic_objective_id) {
            throw ValidationException::withMessages([
                'strategic_objective_id' => 'A risk must be linked to an objective before it enters the register.',
            ]);
        }
        if (! $risk->risk_owner_id) {
            throw ValidationException::withMessages([
                'risk_owner_id' => 'A single accountable Risk Owner is required.',
            ]);
        }
    }

    // ── Private helper ────────────────────────────────────────────────────────

    public function recordHistory(
        Risk $risk,
        string $changeType,
        User $actor,
        ?string $fromStatus,
        ?string $toStatus,
        array $oldValues = [],
        array $newValues = [],
        ?string $notes = null
    ): RiskHistory {
        $hash = hash('sha256', json_encode([
            'risk_id' => $risk->id,
            'type' => $changeType,
            'actor' => $actor->id,
            'ts' => now()->toISOString(),
        ]));

        return RiskHistory::create([
            'tenant_id' => $risk->tenant_id,
            'risk_id' => $risk->id,
            'actor_id' => $actor->id,
            'change_type' => $changeType,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'old_values' => $oldValues ?: null,
            'new_values' => $newValues ?: null,
            'hash' => $hash,
            'notes' => $notes,
        ]);
    }
}
