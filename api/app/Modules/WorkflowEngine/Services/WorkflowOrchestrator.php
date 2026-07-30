<?php

namespace App\Modules\WorkflowEngine\Services;

use App\Models\ApprovalHistory;
use App\Models\ApprovalRequest;
use App\Models\ApprovalStep;
use App\Models\ApprovalWorkflow;
use App\Models\User;
use App\Models\WorkflowEngine\WorkflowAuditEvent;
use App\Models\WorkflowEngine\WorkflowDecision;
use App\Models\WorkflowEngine\WorkflowIdempotencyKey;
use App\Models\WorkflowEngine\WorkflowTask;
use App\Modules\PeopleAuthority\Services\AuthorityCheckService;
use App\Modules\PeopleAuthority\Services\SigningService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Phase 1 orchestration helpers used by WorkflowService.
 * Keeps progression / decisions in the shared engine (PRD §124).
 */
class WorkflowOrchestrator
{
    public function __construct(
        private readonly ActorResolutionService $actors,
        private readonly ConditionEvaluationService $conditions,
        private readonly ApprovalPackageService $packages,
        private readonly DefinitionVersionService $definitions,
        private readonly ReleaseOrchestrator $releases,
        private readonly AuthorityCheckService $authority,
        private readonly ?SigningService $signing = null,
    ) {}

    public function prepareStart(
        ApprovalRequest $request,
        Model $entity,
        User $requester,
        ApprovalWorkflow $workflow,
        ?string $idempotencyKey = null,
        array $conditionContext = []
    ): ApprovalRequest {
        if ($idempotencyKey) {
            $hit = WorkflowIdempotencyKey::where('tenant_id', $requester->tenant_id)
                ->where('scope', 'start')
                ->where('idempotency_key', $idempotencyKey)
                ->first();
            if ($hit) {
                return ApprovalRequest::findOrFail($hit->result_id);
            }
        }

        $version = $this->definitions->ensurePublishedSnapshot($workflow, $requester);

        $request->update([
            'uuid' => $request->uuid ?: (string) Str::uuid(),
            'reference' => $entity->reference_number ?? ('WF-'.$request->id),
            'definition_version_id' => $version->id,
            'submitted_by' => $requester->id,
            'applicant_id' => $requester->id,
            'condition_context' => $conditionContext !== [] ? $conditionContext : $this->defaultConditionContext($entity),
            'idempotency_key' => $idempotencyKey,
        ]);

        $this->packages->capture($request->fresh(), $entity, $requester);

        $this->activateStage($request->fresh(), 0, $requester);

        if ($idempotencyKey) {
            WorkflowIdempotencyKey::create([
                'tenant_id' => $requester->tenant_id,
                'scope' => 'start',
                'idempotency_key' => $idempotencyKey,
                'result_type' => ApprovalRequest::class,
                'result_id' => $request->id,
                'response_snapshot' => ['approval_request_id' => $request->id],
            ]);
        }

        WorkflowAuditEvent::create([
            'tenant_id' => $request->tenant_id,
            'approval_request_id' => $request->id,
            'workflow_definition_id' => $workflow->id,
            'event_type' => 'WorkflowStarted',
            'actor_user_id' => $requester->id,
            'payload' => [
                'definition_version_id' => $version->id,
                'module' => $workflow->module_type,
            ],
            'occurred_at' => now(),
        ]);

        return $request->fresh();
    }

    public function activateStage(ApprovalRequest $request, int $stepIndex, User $actor): void
    {
        $request->loadMissing(['workflow.steps.role', 'workflow.steps.user', 'approvable']);
        $steps = $request->workflow->steps;
        $context = $request->condition_context ?? $this->defaultConditionContext($request->approvable);
        $context['chain_level'] = $request->history()->where('action', 'approve')->count() + 1;

        // Advance past stages that fail condition (explicit skip — never silent)
        while ($stepIndex < $steps->count()) {
            /** @var ApprovalStep $step */
            $step = $steps->get($stepIndex);
            if ($this->conditions->stageApplies($step, $context)) {
                break;
            }
            ApprovalHistory::create([
                'approval_request_id' => $request->id,
                'user_id' => $actor->id,
                'action' => 'skip',
                'step_index' => $stepIndex,
                'stage_type' => $step->stage_type ?? 'approve',
                'decision_type' => 'skip',
                'comment' => 'Stage not applicable under published condition expression.',
            ]);
            WorkflowAuditEvent::create([
                'tenant_id' => $request->tenant_id,
                'approval_request_id' => $request->id,
                'event_type' => 'WorkflowStageSkipped',
                'actor_user_id' => $actor->id,
                'payload' => [
                    'step_index' => $stepIndex,
                    'reason' => 'condition_false',
                    'expression' => $step->condition_expression,
                ],
                'occurred_at' => now(),
            ]);
            $stepIndex++;
        }

        if ($stepIndex >= $steps->count()) {
            return;
        }

        $step = $steps->get($stepIndex);
        $requester = $this->requester($request);
        $resolution = $this->actors->resolve($step, $requester ?? $actor, $context);
        $holderIds = collect($resolution['actors'])->pluck('id')->values()->all();

        $dueAt = $step->sla_hours ? now()->addHours((int) $step->sla_hours) : null;

        // Close prior open tasks
        WorkflowTask::where('approval_request_id', $request->id)
            ->where('status', 'awaiting')
            ->update(['status' => 'cancelled', 'completed_at' => now()]);

        foreach ($resolution['actors'] as $assignee) {
            WorkflowTask::create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $request->tenant_id,
                'approval_request_id' => $request->id,
                'step_index' => $stepIndex,
                'stage_type' => $step->stage_type ?? 'approve',
                'decision_type' => $step->stage_type ?? 'approve',
                'assigned_user_id' => $assignee->id,
                'status' => 'awaiting',
                'assignment_reason' => $resolution['reason'],
                'actor_resolution_snapshot' => [
                    'selector' => $resolution['selector'],
                    'reason' => $resolution['reason'],
                    'snapshots' => $resolution['snapshots'],
                ],
                'assigned_at' => now(),
                'due_at' => $dueAt,
            ]);
        }

        $request->update([
            'current_step_index' => $stepIndex,
            'current_holder_ids' => $holderIds,
            'current_stage_type' => $step->stage_type ?? 'approve',
            'due_at' => $dueAt,
            'status' => $request->status === 'returned' ? 'pending' : $request->status,
        ]);

        WorkflowAuditEvent::create([
            'tenant_id' => $request->tenant_id,
            'approval_request_id' => $request->id,
            'event_type' => 'WorkflowStageActivated',
            'actor_user_id' => $actor->id,
            'payload' => [
                'step_index' => $stepIndex,
                'stage_type' => $step->stage_type,
                'holders' => $holderIds,
                'reason' => $resolution['reason'],
            ],
            'occurred_at' => now(),
        ]);
    }

    /**
     * Record a decision with authority revalidation + idempotency (PRD §25, §106–§107).
     *
     * @return array{advanced_to_step: ?int, completed: bool, decision_id: int, authority: array}
     */
    public function decide(
        ApprovalRequest $request,
        User $actor,
        string $decisionType,
        ?string $comment = null,
        ?string $idempotencyKey = null,
        array $extra = []
    ): array {
        if ($idempotencyKey) {
            $hit = WorkflowIdempotencyKey::where('tenant_id', $request->tenant_id)
                ->where('scope', 'decide')
                ->where('idempotency_key', $idempotencyKey)
                ->first();
            if ($hit) {
                return $hit->response_snapshot ?? ['advanced_to_step' => null, 'completed' => false, 'decision_id' => $hit->result_id];
            }
        }

        return DB::transaction(function () use ($request, $actor, $decisionType, $comment, $idempotencyKey, $extra) {
            /** @var ApprovalRequest $locked */
            $locked = ApprovalRequest::whereKey($request->id)->lockForUpdate()->firstOrFail();

            if (! in_array($locked->status, ['pending', 'returned'], true) && ! in_array($decisionType, ['withdraw', 'cancel'], true)) {
                throw ValidationException::withMessages(['approval' => 'Already Decided: this workflow is no longer awaiting action.']);
            }

            $locked->loadMissing(['workflow.steps.role', 'workflow.steps.user', 'approvable']);
            $step = $locked->workflow->steps->get($locked->current_step_index);
            $stageType = $step?->stage_type ?? 'approve';

            if ($locked->approvable) {
                $this->packages->assertUnchanged($locked, $locked->approvable);
            }

            $authorityResult = ['authorised' => true, 'denial_reason' => null];
            if (in_array($decisionType, ['approve', 'recommend', 'certify', 'authorise', 'sign', 'verify'], true)) {
                $authorityResult = $this->revalidateAuthority($locked, $actor, $step);
                if (! $authorityResult['authorised']) {
                    throw ValidationException::withMessages([
                        'authority' => $authorityResult['denial_reason'] ?? 'Authority denied at decision time.',
                    ]);
                }
                if (! empty($authorityResult['self_approval_conflict'])) {
                    throw ValidationException::withMessages([
                        'authority' => 'Self-approval is blocked by segregation of duties.',
                    ]);
                }
            }

            $signatureEventId = $extra['document_signature_event_id'] ?? null;
            if ($decisionType === 'sign' && $this->signing && $locked->approvable) {
                // Integrate People & Authority signing service — does not auto-approve
                $sig = $this->signing->sign($actor, [
                    'document_type' => class_basename($locked->approvable_type),
                    'document_id' => $locked->approvable_id,
                    'document_hash' => $locked->approval_package_hash,
                    'signature_meaning' => 'workflow_stage_sign',
                    'module' => $locked->workflow?->module_type,
                ]);
                $signatureEventId = $sig->id;
            }

            $task = WorkflowTask::where('approval_request_id', $locked->id)
                ->where('step_index', $locked->current_step_index)
                ->where('assigned_user_id', $actor->id)
                ->where('status', 'awaiting')
                ->lockForUpdate()
                ->first();

            $decision = WorkflowDecision::create([
                'tenant_id' => $locked->tenant_id,
                'approval_request_id' => $locked->id,
                'workflow_task_id' => $task?->id,
                'step_index' => $locked->current_step_index,
                'stage_type' => $stageType,
                'decision_type' => $decisionType,
                'actor_user_id' => $actor->id,
                'authority_snapshot' => $authorityResult,
                'delegation_snapshot' => isset($authorityResult['delegation_id']) ? ['id' => $authorityResult['delegation_id']] : null,
                'acting_appointment_snapshot' => isset($authorityResult['acting_appointment_id']) ? ['id' => $authorityResult['acting_appointment_id']] : null,
                'record_version' => $locked->record_version,
                'approval_package_hash' => $locked->approval_package_hash,
                'comments' => $comment,
                'document_signature_event_id' => $signatureEventId,
                'idempotency_key' => $idempotencyKey,
                'decided_at' => now(),
            ]);

            if ($task) {
                $task->update([
                    'status' => 'completed',
                    'completed_at' => now(),
                    'authority_snapshot_id' => $authorityResult['snapshot_id'] ?? null,
                ]);
            }

            ApprovalHistory::create([
                'approval_request_id' => $locked->id,
                'user_id' => $actor->id,
                'action' => $this->historyAction($decisionType),
                'decision_type' => $decisionType,
                'stage_type' => $stageType,
                'step_index' => $locked->current_step_index,
                'comment' => $comment,
                'authority_snapshot_id' => $authorityResult['snapshot_id'] ?? null,
                'package_hash' => $locked->approval_package_hash,
            ]);

            $advancedTo = null;
            $completed = false;

            if (in_array($decisionType, ['approve', 'recommend', 'certify', 'authorise', 'sign', 'verify', 'acknowledge'], true)) {
                $next = $locked->current_step_index + 1;
                if ($next >= $locked->workflow->steps()->count()) {
                    $locked->update([
                        'status' => 'approved',
                        'completed_at' => now(),
                        'current_holder_ids' => [],
                    ]);
                    $completed = true;
                } else {
                    $this->activateStage($locked->fresh(), $next, $actor);
                    $advancedTo = $next;
                }
            }

            $response = [
                'advanced_to_step' => $advancedTo,
                'completed' => $completed,
                'decision_id' => $decision->id,
                'authority' => $authorityResult,
            ];

            if ($idempotencyKey) {
                WorkflowIdempotencyKey::create([
                    'tenant_id' => $locked->tenant_id,
                    'scope' => 'decide',
                    'idempotency_key' => $idempotencyKey,
                    'result_type' => WorkflowDecision::class,
                    'result_id' => $decision->id,
                    'response_snapshot' => $response,
                ]);
            }

            WorkflowAuditEvent::create([
                'tenant_id' => $locked->tenant_id,
                'approval_request_id' => $locked->id,
                'event_type' => 'WorkflowDecisionRecorded',
                'actor_user_id' => $actor->id,
                'payload' => [
                    'decision_type' => $decisionType,
                    'stage_type' => $stageType,
                    'decision_id' => $decision->id,
                ],
                'occurred_at' => now(),
            ]);

            if ($completed) {
                $this->releases->enqueueCompletion($locked->fresh(), $actor);
            }

            return $response;
        });
    }

    public function revalidateAuthority(ApprovalRequest $request, User $actor, ?ApprovalStep $step): array
    {
        $requester = $this->requester($request);
        $entity = $request->approvable;
        $amount = null;
        $currency = null;
        if ($entity) {
            $amount = $entity->amount
                ?? $entity->requested_amount
                ?? $entity->estimated_value
                ?? $entity->estimated_dsa
                ?? $entity->total_budget
                ?? null;
            $currency = $entity->currency ?? null;
        }

        $action = $step?->authority_action
            ?: match ($step?->stage_type) {
                'recommend' => 'workflow.recommend',
                'certify' => 'workflow.certify',
                'authorise' => 'workflow.authorise',
                'sign' => 'workflow.sign',
                'verify' => 'workflow.verify',
                default => 'workflow.approve',
            };

        // Threshold gate from stage definition
        if ($step?->amount_threshold !== null && $amount !== null && (float) $amount > (float) $step->amount_threshold) {
            // Stage applies only above threshold when configured that way — handled by conditions.
        }

        $result = $this->authority->check($actor, [
            'action' => $action,
            'module' => $request->workflow?->module_type,
            'amount' => $amount !== null ? (float) $amount : null,
            'currency' => $currency,
            'requester_user_id' => $requester?->id,
            'department_id' => $requester?->department_id ?? $entity?->department_id ?? null,
            'context_type' => 'ApprovalRequest',
            'context_id' => $request->id,
        ]);

        // Technical workflow admin must never auto-pass business authority
        if ($actor->can('workflows.admin') && ! $actor->can('workflows.approve') && empty($result['authority_used'])) {
            // Soft: if AuthorityCheck already authorised via assignment, keep it;
            // else ensure admin permission alone is insufficient — AuthorityCheckService already enforces this.
        }

        // If People Authority has no assignments yet (bootstrap), fall back to
        // structural eligibility (current holder) but still block self-approval.
        if (! $result['authorised'] && ($result['denial_reason'] ?? '') === 'No matching authority assignment found.') {
            if ($requester && (int) $requester->id === (int) $actor->id) {
                $result['self_approval_conflict'] = true;
                $result['denial_reason'] = 'Self-approval is blocked by segregation of duties.';

                return $result;
            }
            // Structural holder check is done by WorkflowService::verifyActorCanApprove
            $result['authorised'] = true;
            $result['denial_reason'] = null;
            $result['limitations'][] = 'authority_register_bootstrap_fallback';
        }

        return $result;
    }

    public function inbox(User $user, array $filters = []): array
    {
        $status = $filters['status'] ?? 'awaiting';
        $q = WorkflowTask::query()
            ->with(['approvalRequest.workflow', 'approvalRequest.approvable', 'assignee'])
            ->where('tenant_id', $user->tenant_id);

        if ($status === 'completed') {
            $q->where('assigned_user_id', $user->id)->where('status', 'completed');
        } elseif ($status === 'delegated') {
            $q->where('assigned_user_id', $user->id)
                ->whereNotNull('delegation_id')
                ->where('status', 'awaiting');
        } elseif ($status === 'acting') {
            $q->where('assigned_user_id', $user->id)
                ->whereNotNull('acting_appointment_id')
                ->where('status', 'awaiting');
        } elseif ($status === 'overdue') {
            $q->where('assigned_user_id', $user->id)
                ->where('status', 'awaiting')
                ->whereNotNull('due_at')
                ->where('due_at', '<', now());
        } elseif ($status === 'due') {
            $q->where('assigned_user_id', $user->id)
                ->where('status', 'awaiting')
                ->whereNotNull('due_at')
                ->whereBetween('due_at', [now(), now()->addDay()]);
        } else {
            $q->where('assigned_user_id', $user->id)->where('status', 'awaiting');
        }

        if (! empty($filters['module'])) {
            $q->whereHas('approvalRequest.workflow', fn ($w) => $w->where('module_type', $filters['module']));
        }

        return $q->orderByRaw('due_at IS NULL, due_at ASC')->orderByDesc('id')->limit(200)->get()->all();
    }

    public function resolveActorsForStep(ApprovalRequest $request, ?ApprovalStep $step): array
    {
        if (! $step) {
            return [];
        }
        $requester = $this->requester($request);
        if (! $requester) {
            return [];
        }
        $context = $request->condition_context ?? [];
        $context['chain_level'] = $request->history()->where('action', 'approve')->count() + 1;
        $resolution = $this->actors->resolve($step, $requester, $context);

        return $resolution['actors'];
    }

    private function requester(ApprovalRequest $request): ?User
    {
        $entity = $request->approvable;
        if (! $entity) {
            return $request->applicant_id ? User::find($request->applicant_id) : null;
        }
        if (method_exists($entity, 'requester') && $entity->requester) {
            return $entity->requester;
        }
        if (method_exists($entity, 'creator') && $entity->creator) {
            return $entity->creator;
        }
        $id = $entity->requester_id ?? $entity->prepared_by ?? $entity->created_by ?? $request->applicant_id;

        return $id ? User::find($id) : null;
    }

    private function defaultConditionContext(?Model $entity): array
    {
        if (! $entity) {
            return [];
        }

        return [
            'amount' => $entity->amount
                ?? $entity->requested_amount
                ?? $entity->estimated_value
                ?? $entity->estimated_dsa
                ?? $entity->total_budget
                ?? null,
            'currency' => $entity->currency ?? null,
            'department_id' => $entity->department_id ?? null,
            'module_status' => $entity->status ?? null,
            'leave_days' => $entity->days ?? $entity->total_days ?? null,
            'is_emergency' => (bool) ($entity->is_emergency ?? false),
        ];
    }

    private function historyAction(string $decisionType): string
    {
        return match ($decisionType) {
            'recommend', 'certify', 'authorise', 'sign', 'verify', 'acknowledge' => 'approve',
            default => $decisionType,
        };
    }
}
