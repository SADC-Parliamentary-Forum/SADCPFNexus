<?php

namespace App\Modules\Audit\Services;

use App\Models\Assignment;
use App\Models\AuditCorrectiveAction;
use App\Models\AuditFinding;
use App\Models\AuditManagementResponse;
use App\Models\AuditObservation;
use App\Models\AuditRecommendation;
use App\Models\AuditVerification;
use App\Models\Risk;
use App\Models\User;
use App\Modules\Assignments\Services\AssignmentService;
use App\Services\NotificationService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AuditFindingService
{
    public function __construct(
        private readonly AuditEventRecorder $events,
        private readonly AuditAccessGate $gate,
        private readonly AssignmentService $assignments,
        private readonly NotificationService $notifications,
    ) {}

    public function list(array $filters, User $user): LengthAwarePaginator
    {
        $q = AuditFinding::query()
            ->with(['correctiveActions'])
            ->where('tenant_id', $user->tenant_id)
            ->orderByDesc('id');
        if (! empty($filters['status'])) {
            $statuses = array_values(array_filter(array_map('trim', explode(',', (string) $filters['status']))));
            if (count($statuses) > 1) {
                $q->whereIn('status', $statuses);
            } elseif ($statuses !== []) {
                $q->where('status', $statuses[0]);
            }
        }
        if (! empty($filters['engagement_id'])) {
            $q->where('engagement_id', $filters['engagement_id']);
        }
        if (! empty($filters['search'])) {
            $term = $filters['search'];
            // Privacy: do not leak confidential finding text via broad search for non-cleared users.
            if (! $this->gate->canViewConfidential($user)) {
                $q->whereNotIn('confidentiality_level', ['confidential', 'secret']);
            }
            $q->where(function ($qq) use ($term) {
                $qq->where('title', 'ilike', "%{$term}%")
                    ->orWhere('reference_number', 'ilike', "%{$term}%");
            });
        }

        $page = $q->paginate($filters['per_page'] ?? 20);
        $page->getCollection()->transform(function (AuditFinding $f) use ($user) {
            if (in_array($f->confidentiality_level, ['confidential', 'secret'], true) && ! $this->gate->canViewConfidential($user)) {
                $f->title = '[Restricted]';
                $f->criterion = null;
                $f->condition_text = null;
                $f->cause = null;
                $f->effect = null;
                $f->recommendation = null;
                $f->setAttribute('redacted', true);
            }

            return $f;
        });

        return $page;
    }

    public function createFromObservation(AuditObservation $observation, array $data, User $user): AuditFinding
    {
        $this->assertTenant($observation->tenant_id, $user);

        return DB::transaction(function () use ($observation, $data, $user) {
            $finding = $this->createFinding(array_merge($data, [
                'engagement_id' => $observation->engagement_id,
                'observation_id' => $observation->id,
                'title' => $data['title'] ?? $observation->title,
            ]), $user);

            $observation->update([
                'status' => 'converted',
                'converted_finding_id' => $finding->id,
            ]);

            return $finding;
        });
    }

    public function createFinding(array $data, User $user): AuditFinding
    {
        $repeatOf = null;
        if (! empty($data['repeat_of_finding_id'])) {
            $repeatOf = AuditFinding::where('tenant_id', $user->tenant_id)->find($data['repeat_of_finding_id']);
        } elseif (! empty($data['detect_repeat']) && ! empty($data['title'])) {
            $repeatOf = AuditFinding::where('tenant_id', $user->tenant_id)
                ->where('title', $data['title'])
                ->where('is_final', true)
                ->orderByDesc('id')
                ->first();
        }

        $finding = AuditFinding::create([
            'tenant_id' => $user->tenant_id,
            'engagement_id' => $data['engagement_id'],
            'observation_id' => $data['observation_id'] ?? null,
            'reference_number' => $data['reference_number'] ?? ('AF-'.now()->format('Y').'-'.str_pad((string) random_int(1, 9999), 4, '0', STR_PAD_LEFT)),
            'title' => $data['title'],
            'criterion' => $data['criterion'] ?? null,
            'condition_text' => $data['condition_text'] ?? null,
            'cause' => $data['cause'] ?? null,
            'effect' => $data['effect'] ?? null,
            'recommendation' => $data['recommendation'] ?? null,
            'rating' => $data['rating'] ?? null,
            'root_cause_category' => $data['root_cause_category'] ?? null,
            'status' => 'draft',
            'repeat_of_finding_id' => $repeatOf?->id,
            'linked_risk_id' => $data['linked_risk_id'] ?? null,
            'created_by' => $user->id,
            'confidentiality_level' => $data['confidentiality_level'] ?? 'restricted',
        ]);

        if (! empty($data['recommendation'])) {
            AuditRecommendation::create([
                'tenant_id' => $user->tenant_id,
                'finding_id' => $finding->id,
                'recommendation_text' => $data['recommendation'],
                'created_by' => $user->id,
            ]);
        }

        $this->events->record('audit.finding.created', $user, AuditFinding::class, $finding->id, [
            'repeat_of' => $repeatOf?->id,
        ]);

        return $finding->fresh(['recommendations']);
    }

    public function updateDraft(AuditFinding $finding, array $data, User $user): AuditFinding
    {
        $this->assertTenant($finding->tenant_id, $user);
        $finding->assertFindingTextEditable();

        // Management cannot edit finding text even in draft if they lack findings.issue
        if (! $user->can('audit.findings.issue') && ! $user->can('audit.admin') && ! $user->hasRole('Internal Auditor')) {
            throw ValidationException::withMessages([
                'finding' => 'Management cannot edit finding text. Use management response instead.',
            ]);
        }

        $finding->update(array_filter([
            'title' => $data['title'] ?? null,
            'criterion' => $data['criterion'] ?? null,
            'condition_text' => $data['condition_text'] ?? null,
            'cause' => $data['cause'] ?? null,
            'effect' => $data['effect'] ?? null,
            'recommendation' => $data['recommendation'] ?? null,
            'rating' => $data['rating'] ?? null,
            'root_cause_category' => $data['root_cause_category'] ?? null,
            'confidentiality_level' => $data['confidentiality_level'] ?? null,
            'linked_risk_id' => $data['linked_risk_id'] ?? null,
        ], fn ($v) => $v !== null));

        $this->events->record('audit.finding.updated', $user, AuditFinding::class, $finding->id);

        return $finding->fresh();
    }

    public function issue(AuditFinding $finding, User $user): AuditFinding
    {
        $this->assertTenant($finding->tenant_id, $user);
        if (! $user->can('audit.findings.issue') && ! $user->can('audit.admin')) {
            throw ValidationException::withMessages(['auth' => 'Not authorised to issue findings.']);
        }
        if ($finding->is_final) {
            throw ValidationException::withMessages(['finding' => 'Finding already issued.']);
        }

        $finding->update([
            'status' => 'issued',
            'is_final' => true,
            'issued_by' => $user->id,
            'issued_at' => now(),
        ]);

        $this->events->record('audit.finding.issued', $user, AuditFinding::class, $finding->id);

        return $finding->fresh();
    }

    public function addManagementResponse(AuditFinding $finding, array $data, User $user): AuditManagementResponse
    {
        $this->assertTenant($finding->tenant_id, $user);
        if (! $finding->is_final) {
            throw ValidationException::withMessages(['finding' => 'Responses are only accepted on issued findings.']);
        }
        if (! $user->can('audit.response.manage') && ! $user->can('audit.admin') && ! $user->hasAnyRole(['Director', 'HOD', 'staff', 'Secretary General'])) {
            throw ValidationException::withMessages(['auth' => 'Not authorised to submit management responses.']);
        }

        // Explicit: cannot edit finding text via response path
        if (isset($data['criterion']) || isset($data['condition_text']) || isset($data['title'])) {
            throw ValidationException::withMessages([
                'finding' => 'Management cannot edit finding text.',
            ]);
        }

        $version = (int) AuditManagementResponse::where('finding_id', $finding->id)->max('version') + 1;
        $response = AuditManagementResponse::create([
            'tenant_id' => $user->tenant_id,
            'finding_id' => $finding->id,
            'version' => $version,
            'response_text' => $data['response_text'],
            'agrees' => (bool) ($data['agrees'] ?? true),
            'disagreement_notes' => ($data['agrees'] ?? true) ? null : ($data['disagreement_notes'] ?? $data['response_text']),
            'responded_by' => $user->id,
            'responded_at' => now(),
        ]);

        $finding->update(['status' => 'management_response']);
        $this->events->record('audit.finding.management_response', $user, AuditFinding::class, $finding->id, [
            'version' => $version,
            'agrees' => $response->agrees,
        ]);

        return $response;
    }

    public function addRecommendation(AuditFinding $finding, string $text, User $user): AuditRecommendation
    {
        $this->assertTenant($finding->tenant_id, $user);
        $rec = AuditRecommendation::create([
            'tenant_id' => $user->tenant_id,
            'finding_id' => $finding->id,
            'recommendation_text' => $text,
            'created_by' => $user->id,
        ]);
        $this->events->record('audit.recommendation.created', $user, AuditRecommendation::class, $rec->id);

        return $rec;
    }

    public function createCorrectiveAction(AuditFinding $finding, array $data, User $user): AuditCorrectiveAction
    {
        $this->assertTenant($finding->tenant_id, $user);
        if (! $finding->is_final) {
            throw ValidationException::withMessages(['finding' => 'Corrective actions require an issued finding.']);
        }

        // Auditors must not implement corrective actions they later verify (SoD).
        $isAuditorOnly = $user->hasRole('Internal Auditor')
            && ! $user->hasAnyRole(['Director', 'HOD', 'Secretary General', 'System Admin', 'super-admin']);
        if ($isAuditorOnly && ! empty($data['implement_now'])) {
            throw ValidationException::withMessages([
                'sod' => 'Auditors cannot implement corrective actions they may later verify.',
            ]);
        }

        return DB::transaction(function () use ($finding, $data, $user) {
            $action = AuditCorrectiveAction::create([
                'tenant_id' => $user->tenant_id,
                'finding_id' => $finding->id,
                'recommendation_id' => $data['recommendation_id'] ?? null,
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'owner_user_id' => $data['owner_user_id'] ?? null,
                'due_date' => $data['due_date'] ?? null,
                'status' => 'planned',
                'created_by' => $user->id,
                'confidentiality_level' => $data['confidentiality_level'] ?? $finding->confidentiality_level,
            ]);

            // Must use shared Assignments module
            $assignment = $this->assignments->create([
                'title' => 'CA: '.$action->title,
                'description' => $action->description ?? ('Corrective action for finding '.$finding->reference_number),
                'assigned_to' => $action->owner_user_id,
                'due_date' => $action->due_date ?? now()->addDays(30)->toDateString(),
                'source_type' => 'audit_finding',
                'source_id' => $finding->id,
                'source_reference' => $finding->reference_number,
                'source_title' => $finding->title,
                'source_purpose' => 'corrective_action:'.$action->id,
                'is_confidential' => in_array($action->confidentiality_level, ['confidential', 'secret', 'restricted'], true),
                'priority' => 'high',
                'require_owner' => false,
            ], $user);

            $action->update(['assignment_id' => $assignment->id, 'status' => 'in_progress']);
            $finding->update(['status' => 'corrective_in_progress']);

            $this->events->record('audit.corrective.created', $user, AuditCorrectiveAction::class, $action->id, [
                'assignment_id' => $assignment->id,
            ]);

            return $action->fresh(['assignment']);
        });
    }

    public function markCorrectiveComplete(AuditCorrectiveAction $action, User $user): AuditCorrectiveAction
    {
        $this->assertTenant($action->tenant_id, $user);

        $isAuditorOnly = $user->hasRole('Internal Auditor')
            && ! $user->hasAnyRole(['Director', 'HOD', 'Secretary General', 'System Admin', 'super-admin']);
        if ($isAuditorOnly) {
            throw ValidationException::withMessages([
                'sod' => 'Auditors cannot mark corrective actions complete; management owns implementation.',
            ]);
        }

        $action->update([
            'status' => 'due_for_verification',
            'implemented_by' => $user->id,
            'completed_at' => now(),
        ]);

        // Assignment completion ≠ finding closure
        $finding = $action->finding;
        $finding->update(['status' => 'due_for_verification']);

        $this->events->record('audit.corrective.completed', $user, AuditCorrectiveAction::class, $action->id, [
            'finding_status' => 'due_for_verification',
            'note' => 'Assignment/action completion does not close the finding.',
        ]);

        return $action->fresh();
    }

    public function syncFromAssignmentCompletion(Assignment $assignment): void
    {
        if ($assignment->source_type !== 'audit_finding' || empty($assignment->source_purpose)) {
            return;
        }
        if (! str_starts_with((string) $assignment->source_purpose, 'corrective_action:')) {
            return;
        }
        $actionId = (int) substr((string) $assignment->source_purpose, strlen('corrective_action:'));
        $action = AuditCorrectiveAction::find($actionId);
        if (! $action || $action->status === 'verified_closed') {
            return;
        }
        // Move to due for verification only — never auto-close finding.
        $action->update([
            'status' => 'due_for_verification',
            'completed_at' => $action->completed_at ?? now(),
        ]);
        $action->finding?->update(['status' => 'due_for_verification']);
    }

    public function verify(AuditCorrectiveAction $action, array $data, User $user): AuditVerification
    {
        $this->assertTenant($action->tenant_id, $user);
        if (! $user->can('audit.corrective.verify') && ! $user->can('audit.admin')) {
            throw ValidationException::withMessages(['auth' => 'Not authorised to verify corrective actions.']);
        }

        // SoD: person who implemented cannot verify
        if ($action->implemented_by && (int) $action->implemented_by === (int) $user->id) {
            throw ValidationException::withMessages([
                'sod' => 'You cannot verify a corrective action you implemented.',
            ]);
        }

        if ($action->status !== 'due_for_verification' && $action->status !== 'completed') {
            throw ValidationException::withMessages([
                'status' => 'Corrective action is not due for audit verification.',
            ]);
        }

        $outcome = $data['outcome']; // verified_closed|reopened|insufficient
        $verification = AuditVerification::create([
            'tenant_id' => $user->tenant_id,
            'corrective_action_id' => $action->id,
            'finding_id' => $action->finding_id,
            'outcome' => $outcome,
            'notes' => $data['notes'] ?? null,
            'verified_by' => $user->id,
            'verified_at' => now(),
        ]);

        $finding = $action->finding;
        if ($outcome === 'verified_closed') {
            $action->update(['status' => 'verified_closed']);
            // Close finding only when all corrective actions verified
            $open = AuditCorrectiveAction::where('finding_id', $finding->id)
                ->whereNotIn('status', ['verified_closed', 'cancelled'])
                ->exists();
            if (! $open) {
                $finding->update(['status' => 'closed']);
            }
        } else {
            $action->update(['status' => 'reopened']);
            $finding->update(['status' => 'reopened']);
        }

        $this->events->record('audit.corrective.verified', $user, AuditVerification::class, $verification->id, [
            'outcome' => $outcome,
            'finding_id' => $finding->id,
        ]);

        return $verification;
    }

    public function linkRisk(AuditFinding $finding, int $riskId, User $user): AuditFinding
    {
        $this->assertTenant($finding->tenant_id, $user);
        $risk = Risk::where('tenant_id', $user->tenant_id)->findOrFail($riskId);
        $finding->update([
            'linked_risk_id' => $risk->id,
            'risk_acceptance_status' => 'linked',
        ]);
        $this->events->record('audit.finding.risk_linked', $user, AuditFinding::class, $finding->id, [
            'risk_id' => $risk->id,
        ]);

        return $finding->fresh();
    }

    /**
     * Risk acceptance is owned by Risk Register — Audit does not approve acceptance.
     */
    public function markRiskAcceptancePath(AuditFinding $finding, User $user): AuditFinding
    {
        $this->assertTenant($finding->tenant_id, $user);
        if (! $finding->linked_risk_id) {
            throw ValidationException::withMessages(['linked_risk_id' => 'Link a risk before starting risk-acceptance path.']);
        }

        // Internal Audit cannot accept risks for Management.
        if ($user->hasRole('Internal Auditor')
            && ! $user->hasAnyRole(['Director', 'Governance Officer', 'Secretary General', 'System Admin', 'super-admin'])) {
            throw ValidationException::withMessages([
                'risk_acceptance' => 'Audit does not approve risk acceptance. Use the Risk Register acceptance workflow.',
            ]);
        }

        $finding->update([
            'risk_acceptance_status' => 'acceptance_pending',
            'status' => 'risk_accepted',
        ]);
        $this->events->record('audit.finding.risk_acceptance_path', $user, AuditFinding::class, $finding->id, [
            'note' => 'Acceptance decision belongs to Risk Register, not Audit.',
        ]);

        return $finding->fresh();
    }

    private function assertTenant(int $tenantId, User $user): void
    {
        if ((int) $tenantId !== (int) $user->tenant_id) {
            abort(404);
        }
    }
}
