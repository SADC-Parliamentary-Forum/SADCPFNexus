<?php

namespace App\Modules\WorkflowEngine\Services;

use App\Models\ApprovalRequest;
use App\Models\ApprovalHistory;
use App\Models\User;
use App\Models\WorkflowEngine\WorkflowAuditEvent;
use App\Models\WorkflowEngine\WorkflowDecision;
use App\Models\WorkflowEngine\WorkflowExternalApproval;
use App\Models\WorkflowEngine\WorkflowGovernanceDecision;
use App\Models\WorkflowEngine\WorkflowTask;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Governance-body decisions + external approvals (PRD §42–43 / §122).
 * Recorder ≠ personal “committee approved”; Decision authority = body name.
 */
class GovernanceExternalService
{
    public function __construct(
        private readonly StageCompletionService $completion,
    ) {}

    public function recordGovernance(ApprovalRequest $request, User $recorder, array $data): WorkflowGovernanceDecision
    {
        abort_unless((int) $request->tenant_id === (int) $recorder->tenant_id, 404);

        if (empty($data['body_name'])) {
            throw ValidationException::withMessages(['body_name' => 'Governance body name is required as Decision authority.']);
        }

        $row = WorkflowGovernanceDecision::create([
            'tenant_id' => $request->tenant_id,
            'approval_request_id' => $request->id,
            'step_index' => $data['step_index'] ?? $request->current_step_index,
            'body_name' => $data['body_name'],
            'meeting_reference' => $data['meeting_reference'] ?? null,
            'resolution_reference' => $data['resolution_reference'] ?? null,
            'members_present' => $data['members_present'] ?? null,
            'quorum_required' => $data['quorum_required'] ?? null,
            'quorum_met' => (bool) ($data['quorum_met'] ?? false),
            'decision' => $data['decision'] ?? 'approved',
            'voting_result' => $data['voting_result'] ?? null,
            'recorded_by' => $recorder->id,
            'recorder_role' => $data['recorder_role'] ?? 'secretary',
            'chair_user_id' => $data['chair_user_id'] ?? null,
            'minutes_evidence_path' => $data['minutes_evidence_path'] ?? null,
            'decision_date' => $data['decision_date'] ?? now()->toDateString(),
            'notes' => $data['notes'] ?? null,
        ]);

        ApprovalHistory::create([
            'approval_request_id' => $request->id,
            'user_id' => $recorder->id,
            'action' => 'governance_recorded',
            'decision_type' => $row->decision,
            'stage_type' => $request->current_stage_type,
            'step_index' => $row->step_index,
            'comment' => sprintf(
                'Decision authority: %s. Recorded by: %s (%s). Meeting: %s. Resolution: %s.',
                $row->decisionAuthority(),
                $recorder->name,
                $row->recorder_role,
                $row->meeting_reference ?? 'n/a',
                $row->resolution_reference ?? 'n/a'
            ),
        ]);

        WorkflowAuditEvent::create([
            'tenant_id' => $request->tenant_id,
            'approval_request_id' => $request->id,
            'event_type' => 'GovernanceDecisionRecorded',
            'actor_user_id' => $recorder->id,
            'payload' => [
                'governance_decision_id' => $row->id,
                'decision_authority' => $row->decisionAuthority(),
                'recorded_by' => $recorder->id,
                'recorder_role' => $row->recorder_role,
            ],
            'occurred_at' => now(),
        ]);

        if (($data['advance'] ?? true) && in_array($row->decision, ['approved', 'noted'], true) && $row->quorum_met) {
            $this->advanceAfterExternalOrGovernance($request, $recorder, 'governance', $row->id);
        }

        return $row;
    }

    public function recordExternal(ApprovalRequest $request, User $recorder, array $data): WorkflowExternalApproval
    {
        abort_unless((int) $request->tenant_id === (int) $recorder->tenant_id, 404);

        if (empty($data['decision_date']) || empty($data['decision'])) {
            throw ValidationException::withMessages(['decision' => 'External decision and date are required.']);
        }
        if (empty($data['external_body']) && empty($data['external_person'])) {
            throw ValidationException::withMessages(['external_body' => 'External body or person is required.']);
        }
        if (empty($data['evidence_reference']) && empty($data['evidence_path'])) {
            throw ValidationException::withMessages(['evidence_reference' => 'Evidence reference or path is required for external approvals.']);
        }

        $row = WorkflowExternalApproval::create([
            'tenant_id' => $request->tenant_id,
            'approval_request_id' => $request->id,
            'step_index' => $data['step_index'] ?? $request->current_step_index,
            'external_body' => $data['external_body'] ?? null,
            'external_person' => $data['external_person'] ?? null,
            'decision_date' => $data['decision_date'],
            'decision' => $data['decision'],
            'evidence_reference' => $data['evidence_reference'] ?? null,
            'evidence_path' => $data['evidence_path'] ?? null,
            'notes' => $data['notes'] ?? null,
            'recorded_by' => $recorder->id,
            'recorded_at' => now(),
        ]);

        ApprovalHistory::create([
            'approval_request_id' => $request->id,
            'user_id' => $recorder->id,
            'action' => 'external_approval',
            'decision_type' => $row->decision,
            'stage_type' => $request->current_stage_type,
            'step_index' => $row->step_index,
            'comment' => sprintf(
                'External approval by %s / %s on %s. Evidence: %s. (Not a Nexus click.)',
                $row->external_body ?? 'n/a',
                $row->external_person ?? 'n/a',
                $row->decision_date?->toDateString(),
                $row->evidence_reference ?? $row->evidence_path
            ),
        ]);

        WorkflowAuditEvent::create([
            'tenant_id' => $request->tenant_id,
            'approval_request_id' => $request->id,
            'event_type' => 'ExternalApprovalRecorded',
            'actor_user_id' => $recorder->id,
            'payload' => ['external_approval_id' => $row->id],
            'occurred_at' => now(),
        ]);

        if (($data['advance'] ?? true) && in_array($row->decision, ['approved', 'noted'], true)) {
            $this->advanceAfterExternalOrGovernance($request, $recorder, 'external', $row->id);
        }

        return $row;
    }

    private function advanceAfterExternalOrGovernance(ApprovalRequest $request, User $actor, string $kind, int $id): void
    {
        DB::transaction(function () use ($request, $actor, $kind, $id) {
            $locked = ApprovalRequest::whereKey($request->id)->lockForUpdate()->firstOrFail();
            $stepIndex = $locked->current_step_index;

            WorkflowTask::where('approval_request_id', $locked->id)
                ->where('step_index', $stepIndex)
                ->where('status', 'awaiting')
                ->update(['status' => 'completed', 'completed_at' => now()]);

            WorkflowDecision::create([
                'tenant_id' => $locked->tenant_id,
                'approval_request_id' => $locked->id,
                'step_index' => $stepIndex,
                'stage_type' => $locked->current_stage_type ?? 'approve',
                'decision_type' => 'approve',
                'actor_user_id' => $actor->id,
                'authority_snapshot' => [
                    'kind' => $kind,
                    'source_id' => $id,
                    'note' => $kind === 'governance'
                        ? 'Recorded governance-body decision — authority is the body, not the recorder.'
                        : 'Recorded external approval with evidence — not a Nexus click.',
                ],
                'approval_package_hash' => $locked->approval_package_hash,
                'record_version' => $locked->record_version,
                'governance_decision_id' => $kind === 'governance' ? $id : null,
                'external_approval_id' => $kind === 'external' ? $id : null,
                'comments' => $kind.' recorded',
                'decided_at' => now(),
            ]);

            $this->completion->recordVote($locked, $stepIndex, $actor->id, 'approve', null, $kind);

            $next = $stepIndex + 1;
            $locked->loadMissing('workflow.steps');
            if ($next >= $locked->workflow->steps()->count()) {
                $locked->update([
                    'status' => 'approved',
                    'completed_at' => now(),
                    'current_holder_ids' => [],
                ]);
            } else {
                app(WorkflowOrchestrator::class)->activateStage($locked->fresh(), $next, $actor);
            }
        });
    }
}
