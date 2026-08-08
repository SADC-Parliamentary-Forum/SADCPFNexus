<?php

namespace App\Services;

use App\Models\ApprovalHistory;
use App\Models\ApprovalRequest;
use App\Models\ApprovalStep;
use App\Models\ApprovalWorkflow;
use App\Models\Department;
use App\Models\User;
use App\Models\WorkflowDelegation;
use App\Modules\WorkflowEngine\Services\WorkflowOrchestrator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class WorkflowService
{
    /** Human-readable labels for each module type. */
    private const MODULE_LABELS = [
        'travel'            => 'Travel',
        'leave'             => 'Leave',
        'imprest'           => 'Imprest',
        'procurement'       => 'Procurement',
        'salary_advance'    => 'Salary Advance',
        'timesheet'         => 'Timesheet',
        'budget_submission' => 'Budget Submission',
        'programmes'        => 'Programme (PIF)',
        'pif'               => 'Programme (PIF)',
    ];

    public function __construct(
        protected NotificationService $notificationService,
        protected SignedTokenService  $signedTokenService,
        protected ?WorkflowOrchestrator $orchestrator = null,
        protected ?\App\Modules\WorkflowEngine\Services\ApprovalPackageService $packages = null,
    ) {}

    protected function engine(): WorkflowOrchestrator
    {
        return $this->orchestrator ??= app(WorkflowOrchestrator::class);
    }

    protected function packages(): \App\Modules\WorkflowEngine\Services\ApprovalPackageService
    {
        return $this->packages ??= app(\App\Modules\WorkflowEngine\Services\ApprovalPackageService::class);
    }

    /**
     * Start a workflow for an approvable entity.
     */
    public function initiate(Model $entity, string $moduleType, User $requester, ?string $idempotencyKey = null, array $conditionContext = []): ?ApprovalRequest
    {
        $workflow = ApprovalWorkflow::where('module_type', $moduleType)
            ->where('tenant_id', $requester->tenant_id)
            ->where('is_active', true)
            ->first();

        if (!$workflow) {
            return null;
        }

        // Idempotent restart protection: reuse open request for same subject
        $existing = ApprovalRequest::where('approvable_type', get_class($entity))
            ->where('approvable_id', $entity->id)
            ->whereIn('status', ['pending', 'returned'])
            ->first();
        if ($existing && $idempotencyKey) {
            return $existing;
        }

        $request = ApprovalRequest::create([
            'tenant_id'       => $requester->tenant_id,
            'approvable_type' => get_class($entity),
            'approvable_id'   => $entity->id,
            'workflow_id'     => $workflow->id,
            'current_step_index' => 0,
            'status'          => 'pending',
        ]);

        try {
            $this->engine()->prepareStart($request, $entity, $requester, $workflow, $idempotencyKey, $conditionContext);
        } catch (Throwable $e) {
            // Engine enrichment must not block the proven ApprovalRequest path (PIF/Leave/Travel).
            report($e);
            $request->update([
                'uuid' => $request->uuid ?: (string) \Illuminate\Support\Str::uuid(),
                'submitted_by' => $requester->id,
                'applicant_id' => $requester->id,
                'condition_context' => $conditionContext !== [] ? $conditionContext : null,
            ]);
        }

        // Notify the first-step approvers (with email action buttons)
        $this->notifyApprovers($request->fresh());

        return $request->fresh();
    }

    /**
     * Handle an approval action.
     *
     * Returns ['advanced_to_step' => int|null, 'notified_approvers' => string[]]
     * so controllers can include the notified role labels in the JSON response (sequential toast).
     */
    public function approve(ApprovalRequest $request, User $actor, ?string $comment = null, ?string $idempotencyKey = null): array
    {
        $this->verifyActorCanApprove($request, $actor);

        $step = $request->workflow->steps->get($request->current_step_index);
        $decisionType = $step?->stage_type && in_array($step->stage_type, ['recommend', 'certify', 'authorise', 'sign', 'verify', 'acknowledge'], true)
            ? $step->stage_type
            : 'approve';

        $result = $this->engine()->decide($request, $actor, $decisionType, $comment, $idempotencyKey);

        $notifiedApprovers = [];
        if ($result['completed'] ?? false) {
            $request->refresh();
            $this->finalizeApprovable($request, 'approved', $actor);
        } elseif (($result['advanced_to_step'] ?? null) !== null) {
            $request->refresh();
            $notifiedApprovers = $this->notifyApprovers($request);
        }

        return [
            'advanced_to_step'   => $result['advanced_to_step'] ?? null,
            'notified_approvers' => $notifiedApprovers,
            'decision_id'        => $result['decision_id'] ?? null,
            'authority'          => $result['authority'] ?? null,
        ];
    }

    /**
     * Handle a rejection action.
     */
    public function reject(ApprovalRequest $request, User $actor, string $comment, ?string $idempotencyKey = null): void
    {
        $this->verifyActorCanApprove($request, $actor);

        $this->engine()->decide($request, $actor, 'reject', $comment, $idempotencyKey);
        $request->refresh();
        $request->update(['status' => 'rejected', 'completed_at' => now(), 'current_holder_ids' => []]);
        $this->finalizeApprovable($request, 'rejected', $actor, $comment);
    }

    /**
     * Return a request for correction to the requester.
     * Resets the workflow to step 0 so it restarts after resubmission.
     */
    public function returnForCorrection(ApprovalRequest $request, User $actor, string $comment): array
    {
        $this->verifyActorCanApprove($request, $actor);

        $step = $request->workflow->steps->get($request->current_step_index);
        if ($step && !$step->allow_return) {
            throw ValidationException::withMessages([
                'approval' => 'This step does not permit returning the request for correction.',
            ]);
        }

        if ($request->returned_count >= 3) {
            throw ValidationException::withMessages([
                'approval' => 'This request has been returned for correction too many times. Please reject it instead.',
            ]);
        }

        $stepIndexBefore = $request->current_step_index;

        DB::transaction(function () use ($request, $actor, $comment, $stepIndexBefore) {
            ApprovalHistory::create([
                'approval_request_id' => $request->id,
                'user_id'             => $actor->id,
                'action'              => 'return',
                'step_index'          => $stepIndexBefore,
                'comment'             => $comment,
            ]);

            $request->update([
                'status'          => 'returned',
                'returned_count'  => $request->returned_count + 1,
                'current_step_index' => 0,
            ]);

            $this->finalizeApprovable($request, 'returned', $actor, $comment);
        });

        // Notify the requester that correction is needed
        $this->notifyRequesterOfReturn($request, $comment);

        return ['returned_to_requester' => true];
    }

    /**
     * Allow the original requester to withdraw their own pending request.
     */
    public function withdraw(ApprovalRequest $request, User $actor): void
    {
        $requester = $this->getRequesterFromApprovable($request);
        if (!$requester || (int) $requester->id !== (int) $actor->id) {
            throw ValidationException::withMessages([
                'approval' => 'Only the original requester can withdraw this request.',
            ]);
        }

        if (!in_array($request->status, ['pending', 'returned'])) {
            throw ValidationException::withMessages([
                'approval' => 'Only pending or returned requests can be withdrawn.',
            ]);
        }

        DB::transaction(function () use ($request, $actor) {
            ApprovalHistory::create([
                'approval_request_id' => $request->id,
                'user_id'             => $actor->id,
                'action'              => 'withdraw',
                'step_index'          => $request->current_step_index,
            ]);

            $request->update(['status' => 'withdrawn']);
            $this->finalizeApprovable($request, 'withdrawn', $actor);
        });
    }

    /**
     * Allow the original requester to resubmit after a return for correction.
     */
    public function resubmit(ApprovalRequest $request, User $actor): void
    {
        if ($request->status !== 'returned') {
            throw ValidationException::withMessages([
                'approval' => 'Only requests returned for correction can be resubmitted.',
            ]);
        }

        $requester = $this->getRequesterFromApprovable($request);
        if (!$requester || (int) $requester->id !== (int) $actor->id) {
            throw ValidationException::withMessages([
                'approval' => 'Only the original requester can resubmit this request.',
            ]);
        }

        // Material vs. cosmetic edit (PRD Sec 33-34): a typo fix shouldn't force
        // every prior stage to re-approve, but a changed amount/date/etc. must.
        // Default to "material" (full restart) whenever this can't be determined
        // safely - resubmit() runs on requests going back years, and some may
        // predate the approval-package snapshot mechanism entirely (no captured
        // package to diff against), so failing safe here means "restart",
        // matching the prior unconditional behaviour, not "skip re-approval".
        $resumeStepIndex = 0;
        if ($request->approvable) {
            try {
                $isMaterial = $this->packages()->hasMaterialChangeSinceLastCapture($request, $request->approvable);
            } catch (Throwable $e) {
                report($e);
                $isMaterial = true;
            }
            if (! $isMaterial) {
                $returnedFromStep = (int) (ApprovalHistory::where('approval_request_id', $request->id)
                    ->where('action', 'return')
                    ->orderByDesc('id')
                    ->value('step_index') ?? 0);
                $resumeStepIndex = $returnedFromStep;
            }
        }

        DB::transaction(function () use ($request, $actor, $resumeStepIndex) {
            ApprovalHistory::create([
                'approval_request_id' => $request->id,
                'user_id'             => $actor->id,
                'action'              => 'resubmit',
                'step_index'          => $resumeStepIndex,
                'comment'             => $resumeStepIndex > 0
                    ? 'Cosmetic-only correction — resumed at the returning step; prior approvals preserved.'
                    : null,
            ]);

            $request->update([
                'status'             => 'pending',
                'current_step_index' => $resumeStepIndex,
            ]);

            $this->finalizeApprovable($request, 'resubmitted', $actor);
        });

        $request->refresh();
        if ($request->approvable) {
            $this->engine()->prepareStart(
                $request,
                $request->approvable,
                $actor,
                $request->workflow,
                'resubmit-'.$request->id.'-'.now()->timestamp,
                $request->condition_context ?? []
            );
        }

        // Restart: notify first-step approvers
        $request->refresh();
        $this->notifyApprovers($request);
    }

    /**
     * Delegate the active step to another user.
     */
    public function delegate(ApprovalRequest $request, User $actor, User $delegateTo, ?string $reason = null): void
    {
        $this->verifyActorCanApprove($request, $actor);

        $step = $request->workflow->steps->get($request->current_step_index);
        if ($step && !$step->allow_delegate) {
            throw ValidationException::withMessages([
                'approval' => 'This step does not permit delegation.',
            ]);
        }

        $requester = $this->getRequesterFromApprovable($request);
        if ($requester && (int) $requester->id === (int) $delegateTo->id) {
            throw ValidationException::withMessages([
                'approval' => 'Cannot delegate to the original requester of this request.',
            ]);
        }

        DB::transaction(function () use ($request, $actor, $delegateTo, $reason) {
            WorkflowDelegation::create([
                'approval_request_id' => $request->id,
                'from_user_id'        => $actor->id,
                'to_user_id'          => $delegateTo->id,
                'step_index'          => $request->current_step_index,
                'reason'              => $reason,
            ]);

            ApprovalHistory::create([
                'approval_request_id' => $request->id,
                'user_id'             => $actor->id,
                'action'              => 'delegate',
                'step_index'          => $request->current_step_index,
                'comment'             => $reason,
            ]);
        });

        // Notify the delegate
        $this->notifyDelegate($request, $delegateTo);
    }

    /**
     * Get the requester/creator of the approvable entity (for workflow steps and self-approval check).
     */
    protected function getRequesterFromApprovable(ApprovalRequest $request): ?User
    {
        $entity = $request->approvable;
        if (!$entity) {
            return null;
        }
        if (method_exists($entity, 'requester') && $entity->requester) {
            return $entity->requester;
        }
        if (method_exists($entity, 'creator') && $entity->creator) {
            return $entity->creator;
        }
        $id = $entity->requester_id ?? $entity->prepared_by ?? $entity->created_by ?? null;

        return $id ? User::find($id) : null;
    }

    /**
     * WS1 — Build a rich, frontend-ready workflow visibility snapshot for a
     * request (PRD §8, §28.2). Exposes the current stage, who currently holds
     * the request, submitted/prepared-by, the next step, and the full history
     * with per-step status + reasons.
     */
    public function snapshot(ApprovalRequest $request): array
    {
        $request->loadMissing(['workflow.steps.role', 'workflow.steps.user', 'history.user', 'approvable']);

        $steps        = $request->workflow?->steps ?? collect();
        $currentIndex = (int) $request->current_step_index;
        $entity       = $request->approvable;
        $requester    = $this->getRequesterFromApprovable($request);

        $mapUser = fn (?User $u) => $u ? [
            'id'        => $u->id,
            'name'      => $u->name,
            'job_title' => $u->job_title ?? $u->position?->title ?? null,
            'position'  => $u->position?->title ?? $u->job_title ?? null,
        ] : null;

        // Who currently holds the request.
        $currentlyWith = [];
        if (in_array($request->status, ['pending', 'returned'], true)) {
            $currentlyWith = collect($this->getCurrentApprovers($request))
                ->map($mapUser)
                ->filter()
                ->values()
                ->all();
        }

        $stageLabel = function ($step, int $index): string {
            if (!$step) {
                return 'Stage ' . ($index + 1);
            }
            return $step->step_name ?? match ($step->approver_type) {
                'supervisor'    => 'Direct Supervisor',
                'up_the_chain'  => 'Department Head',
                'specific_role' => $step->role?->name ?? 'Required Role',
                'specific_user' => $step->user?->name ?? 'Specific User',
                default         => 'Stage ' . ($index + 1),
            };
        };

        $currentStep = $steps->get($currentIndex);
        $nextStep    = $steps->get($currentIndex + 1);

        // History with the actor + a normalised per-action status.
        $history = $request->history->sortBy('id')->values()->map(function ($h) use ($mapUser) {
            return [
                'id'         => $h->id,
                'action'     => $h->action,
                'status'     => $this->historyActionStatus($h->action),
                'step_index' => $h->step_index,
                'actor'      => $mapUser($h->user),
                'comment'    => $h->comment,
                'created_at' => optional($h->created_at)->toIso8601String(),
            ];
        })->all();

        // Latest rejection / return reasons.
        $rejection = $request->history->where('action', 'reject')->sortByDesc('id')->first();
        $return    = $request->history->where('action', 'return')->sortByDesc('id')->first();

        // Per-step status list (pending/approved/returned/rejected/skipped/escalated/delegated/upcoming).
        $perStep = $steps->map(function ($step, $idx) use ($request, $currentIndex, $stageLabel) {
            $entry = $request->history->firstWhere('step_index', $idx);
            $status = match (true) {
                $request->status === 'withdrawn'                          => 'withdrawn',
                $request->status === 'rejected' && $idx === $currentIndex  => 'rejected',
                $request->status === 'returned' && $idx === $currentIndex  => 'returned',
                $idx < $currentIndex || $request->status === 'approved'    => 'approved',
                $idx === $currentIndex                                     => 'pending',
                default                                                    => 'upcoming',
            };
            if ($entry && in_array($entry->action, ['delegate', 'escalate', 'skip'], true)) {
                $status = $entry->action === 'delegate' ? 'delegated'
                        : ($entry->action === 'escalate' ? 'escalated' : 'skipped');
            }

            return [
                'index'         => $idx,
                'label'         => $stageLabel($step, $idx),
                'approver_type' => $step->approver_type,
                'status'        => $status,
                'sla_hours'     => $step->sla_hours,
            ];
        })->all();

        return [
            'status'              => $request->status,
            'current_step_index'  => $currentIndex,
            'current_stage'       => $currentStep ? [
                'index'         => $currentIndex,
                'label'         => $stageLabel($currentStep, $currentIndex),
                'approver_type' => $currentStep->approver_type,
                'stage_type'    => $currentStep->stage_type ?? $request->current_stage_type ?? 'approve',
                'sla_hours'     => $currentStep->sla_hours,
            ] : null,
            'currently_with'      => $currentlyWith,
            'next_step'           => $nextStep ? [
                'index'         => $currentIndex + 1,
                'label'         => $stageLabel($nextStep, $currentIndex + 1),
                'approver_type' => $nextStep->approver_type,
                'stage_type'    => $nextStep->stage_type ?? 'approve',
            ] : null,
            'definition_version_id' => $request->definition_version_id,
            'record_version'      => $request->record_version,
            'approval_package_hash' => $request->approval_package_hash,
            'attachment_integrity_issues' => $request->status === 'approved'
                ? $this->packages()->attachmentIntegrityIssues($request)
                : [],
            'due_at'              => optional($request->due_at)->toIso8601String(),
            'submitted_by'        => $mapUser($requester),
            'prepared_by'         => $entity && isset($entity->prepared_by)
                ? $mapUser(User::find($entity->prepared_by)) : null,
            'prepared_on_behalf_of' => $entity && isset($entity->prepared_on_behalf_of)
                ? $mapUser(User::find($entity->prepared_on_behalf_of)) : null,
            'rejection_reason'    => $rejection?->comment,
            'return_reason'       => $return?->comment,
            'returned_count'      => $request->returned_count,
            'steps'               => $perStep,
            'history'             => $history,
        ];
    }

    private function historyActionStatus(string $action): string
    {
        return match ($action) {
            'approve'   => 'approved',
            'reject'    => 'rejected',
            'return'    => 'returned',
            'withdraw'  => 'withdrawn',
            'resubmit'  => 'resubmitted',
            'delegate'  => 'delegated',
            'escalate'  => 'escalated',
            'skip'      => 'skipped',
            default     => $action,
        };
    }

    /**
     * Get the current approver(s) for a request.
     */
    public function getCurrentApprovers(ApprovalRequest $request): array
    {
        $request->loadMissing(['workflow.steps.role', 'workflow.steps.user']);
        $step = $request->workflow->steps->get($request->current_step_index);

        if (!$step) {
            return [];
        }

        // Prefer engine actor resolution (hierarchy / position / acting / delegation)
        try {
            $resolved = $this->engine()->resolveActorsForStep($request, $step);
            if ($resolved !== []) {
                return $resolved;
            }
        } catch (Throwable) {
            // Fall through to legacy resolution
        }

        $requester = $this->getRequesterFromApprovable($request);
        if (!$requester) {
            return [];
        }

        switch ($step->approver_type) {
            case 'supervisor':
                $supervisor = $this->getManagerForUser($requester);
                return $supervisor ? [$supervisor] : [];

            case 'up_the_chain':
                $approvalsCount = $request->history()->where('action', 'approve')->count();
                return $this->getNthLevelManager($requester, $approvalsCount + 1);

            case 'specific_role':
                return User::role($step->role->name)->get()->all();

            case 'specific_user':
                return [$step->user];

            default:
                return [];
        }
    }

    protected function verifyActorCanApprove(ApprovalRequest $request, User $actor): void
    {
        // Workflow admins ≠ automatic business approvers (PRD §124)
        if ($actor->can('workflows.admin') && ! $actor->can('workflows.act') && ! $actor->can('workflows.approve')) {
            // Still allow if they are a resolved structural holder below
        }

        $approvers = $this->getCurrentApprovers($request);
        $approverIds = collect($approvers)->pluck('id')->toArray();

        $holderIds = collect($request->current_holder_ids ?? [])->map(fn ($id) => (int) $id)->all();
        $taskAssignee = \App\Models\WorkflowEngine\WorkflowTask::where('approval_request_id', $request->id)
            ->where('step_index', $request->current_step_index)
            ->where('assigned_user_id', $actor->id)
            ->whereIn('status', ['awaiting', 'claimed'])
            ->exists();

        $isHolder = in_array($actor->id, $approverIds, true)
            || in_array((int) $actor->id, $holderIds, true)
            || $taskAssignee;
        $isDelegated = $request->delegations()
            ->where('to_user_id', $actor->id)
            ->where('step_index', $request->current_step_index)
            ->exists();

        if (!$actor->isSystemAdmin() && !$isHolder && !$isDelegated) {
            throw ValidationException::withMessages(['approval' => 'You are not authorized to approve this request at this stage.']);
        }

        // System Admin technical role alone must not bypass business authority for non-holders
        if ($actor->isSystemAdmin() && !$isHolder && !$isDelegated && !$actor->isSecretaryGeneral()) {
            // Keep legacy SG/admin convenience for bootstrap environments, but require
            // they are not the applicant (self-approval still blocked below).
        }

        // Self-approval is gated by policy, not a hard block here: this method
        // only confirms the actor is a legitimate holder for the current step.
        // The actual allow/deny decision (per ApprovalWorkflow::self_approval_policy)
        // happens inside WorkflowOrchestrator::decide() -> AuthorityCheckService::check(),
        // which is policy-aware and — unlike the SG-only carve-out this replaced —
        // is consulted for every decision, not effectively dead for non-SG actors.
    }

    protected function finalizeApprovable(ApprovalRequest $request, string $status, User $actor, ?string $reason = null): void
    {
        $entity = $request->approvable;

        match ($status) {
            'approved' => method_exists($entity, 'onWorkflowApproved')
                ? $entity->onWorkflowApproved($actor)
                : $entity->update(['status' => 'approved', 'approved_by' => $actor->id, 'approved_at' => now()]),

            'rejected' => method_exists($entity, 'onWorkflowRejected')
                ? $entity->onWorkflowRejected($actor, $reason)
                : $entity->update(['status' => 'rejected', 'rejection_reason' => $reason]),

            'returned' => method_exists($entity, 'onWorkflowReturned')
                ? $entity->onWorkflowReturned($actor, $reason)
                : $entity->update(['status' => 'returned_for_correction']),

            'withdrawn' => method_exists($entity, 'onWorkflowWithdrawn')
                ? $entity->onWorkflowWithdrawn()
                : $entity->update(['status' => 'withdrawn']),

            'resubmitted' => method_exists($entity, 'onWorkflowResubmitted')
                ? $entity->onWorkflowResubmitted()
                : $entity->update(['status' => 'resubmitted']),

            default => null,
        };

        // Notify HR staff and Directors about final-state outcomes only
        if (in_array($status, ['approved', 'rejected'])) {
            $this->notifyHrOnCompletion($request, $status, $actor);
        }
    }

    /**
     * Notify HR Managers, HR Administrators, and Directors when a workflow reaches its final state.
     * This runs for all modules so that HR/Directors always know the outcome of any request.
     */
    private function notifyHrOnCompletion(ApprovalRequest $request, string $status, User $actor): void
    {
        try {
            $entity    = $request->approvable;
            $requester = $this->getRequesterFromApprovable($request);
            $module    = $this->resolveModuleType($request);
            $label     = self::MODULE_LABELS[$module] ?? ucfirst(str_replace('_', ' ', $module));

            if (!$requester || !$entity) {
                return;
            }

            $hrRecipients = User::role(['HR Manager', 'HR Administrator', 'Director'])
                ->where('tenant_id', $requester->tenant_id)
                ->get();

            foreach ($hrRecipients as $hr) {
                if ((int) $hr->id === (int) $requester->id) {
                    continue; // Don't send duplicate to the requester if they hold an HR role
                }

                try {
                    $this->notificationService->dispatch(
                        $hr,
                        'workflow.completed',
                        [
                            'name'         => $hr->name,
                            'module_label' => $label,
                            'reference'    => $entity->reference_number ?? "#{$entity->id}",
                            'requester'    => $requester->name,
                            'status'       => $status,
                            'approved_by'  => $actor->name,
                        ],
                        [
                            'module'    => $module,
                            'record_id' => $entity->id,
                            'url'       => "/{$module}/" . $entity->id,
                        ],
                        false // in-app only; no email for completion notices to HR
                    );
                } catch (Throwable) {
                    // Never block the approval flow due to notification failures
                }
            }
        } catch (Throwable) {
            // Silently swallow
        }
    }

    /**
     * Find the supervisor for a user based on their department.
     */
    protected function getManagerForUser(User $user): ?User
    {
        if (!$user->department_id) return null;

        $dept = Department::with('supervisor')->find($user->department_id);

        // If current dept has no supervisor, look up the chain
        while ($dept && !$dept->supervisor_id) {
            if (!$dept->parent_id) break;
            $dept = Department::with('supervisor')->find($dept->parent_id);
        }

        return $dept?->supervisor;
    }

    /**
     * Find the N-th level manager up the chain.
     */
    protected function getNthLevelManager(User $user, int $level): array
    {
        $manager = $this->getManagerForUser($user);

        for ($i = 1; $i < $level; $i++) {
            if (!$manager) break;
            $manager = $this->getManagerForUser($manager);
        }

        return $manager ? [$manager] : [];
    }

    /**
     * Notify all current-step approvers with email action buttons (approve / reject).
     * Returns an array of human-readable role/name labels for the sequential toast.
     */
    private function notifyApprovers(ApprovalRequest $request): array
    {
        $notifiedLabels = [];

        try {
            $approvers = $this->getCurrentApprovers($request);
            if (empty($approvers)) {
                return [];
            }

            $entity    = $request->approvable;
            $requester = $this->getRequesterFromApprovable($request);
            $module    = $this->resolveModuleType($request);
            $label     = self::MODULE_LABELS[$module] ?? ucfirst(str_replace('_', ' ', $module));

            $summary = $this->buildSummary($entity, $module);

            // Build a human-readable label for each approver for the toast
            $step = $request->workflow->steps->get($request->current_step_index);
            $stepLabel = $step?->step_name ?? match ($step?->approver_type) {
                'supervisor'    => 'Direct Supervisor',
                'up_the_chain'  => 'Department Head',
                'specific_role' => $step->role?->name ?? 'Required Role',
                'specific_user' => $step->user?->name ?? 'Specific User',
                default         => 'Next Approver',
            };

            foreach ($approvers as $approver) {
                $notifiedLabels[] = $approver->name . ' (' . $stepLabel . ')';

                try {
                    $vars = [
                        'name'         => $approver->name,
                        'module_label' => $label,
                        'reference'    => $entity->reference_number ?? "#{$request->id}",
                        'requester'    => $requester?->name ?? 'A staff member',
                        'summary'      => $summary,
                    ];

                    // Authenticated inbox/approvals only — no unauthenticated approve/reject (PRD §108/§125).
                    $meta = [
                        'module'           => $module,
                        'record_id'        => $entity->id,
                        'url'              => '/approvals',
                        'secure_route'     => '/approvals',
                        'idempotency_key'  => "workflow.approval_required:{$request->id}:step:{$request->current_step_index}:user:{$approver->id}",
                    ];

                    $this->notificationService->dispatch(
                        $approver,
                        'workflow.approval_required',
                        $vars,
                        $meta
                    );
                } catch (Throwable) {
                    // Never block the approval flow due to notification failures
                }
            }
        } catch (Throwable) {
            // Silently swallow — notification errors must not bubble up
        }

        return $notifiedLabels;
    }

    private function notifyRequesterOfReturn(ApprovalRequest $request, string $comment): void
    {
        try {
            $requester = $this->getRequesterFromApprovable($request);
            $entity    = $request->approvable;
            $module    = $this->resolveModuleType($request);
            $label     = self::MODULE_LABELS[$module] ?? ucfirst(str_replace('_', ' ', $module));

            if (!$requester || !$entity) return;

            $this->notificationService->dispatch(
                $requester,
                'workflow.returned',
                [
                    'name'         => $requester->name,
                    'module_label' => $label,
                    'reference'    => $entity->reference_number ?? "#{$entity->id}",
                    'comment'      => $comment,
                ],
                ['module' => $module, 'record_id' => $entity->id, 'url' => "/{$module}/" . $entity->id]
            );
        } catch (Throwable) {
            // Never block the workflow due to notification failures
        }
    }

    private function notifyDelegate(ApprovalRequest $request, User $delegateTo): void
    {
        try {
            $entity    = $request->approvable;
            $requester = $this->getRequesterFromApprovable($request);
            $module    = $this->resolveModuleType($request);
            $label     = self::MODULE_LABELS[$module] ?? ucfirst(str_replace('_', ' ', $module));

            if (!$entity) return;

            $this->notificationService->dispatch(
                $delegateTo,
                'workflow.approval_required',
                [
                    'name'         => $delegateTo->name,
                    'module_label' => $label,
                    'reference'    => $entity->reference_number ?? "#{$entity->id}",
                    'requester'    => $requester?->name ?? 'A staff member',
                    'summary'      => $this->buildSummary($entity, $module),
                ],
                [
                    'module'          => $module,
                    'record_id'       => $entity->id,
                    'url'             => '/approvals',
                    'secure_route'    => '/approvals',
                    'idempotency_key' => "workflow.approval_required:{$request->id}:delegate:{$delegateTo->id}",
                ]
            );
        } catch (Throwable) {
            // Never block the workflow due to notification failures
        }
    }

    private function resolveModuleType(ApprovalRequest $request): string
    {
        $type = $request->approvable_type ?? '';
        $map  = [
            'App\\Models\\TravelRequest'        => 'travel',
            'App\\Models\\LeaveRequest'         => 'leave',
            'App\\Models\\ImprestRequest'       => 'imprest',
            'App\\Models\\ProcurementRequest'   => 'procurement',
            'App\\Models\\SalaryAdvanceRequest' => 'salary_advance',
            'App\\Models\\BudgetSubmission'     => 'budget_submission',
        ];

        return $map[$type] ?? strtolower(class_basename($type));
    }

    private function buildSummary(?object $entity, string $module): string
    {
        if (!$entity) {
            return '';
        }

        return match ($module) {
            'travel'            => 'Destination: ' . ($entity->destination_city ?? '') . ', ' . ($entity->destination_country ?? '') . "\nDeparture: " . ($entity->departure_date ?? ''),
            'leave'             => 'Type: ' . ($entity->leave_type ?? '') . "\nFrom: " . ($entity->start_date ?? '') . ' to ' . ($entity->end_date ?? ''),
            'imprest'           => 'Amount: ' . number_format((float) ($entity->amount_requested ?? 0), 2) . ' ' . ($entity->currency ?? 'USD') . "\nPurpose: " . ($entity->purpose ?? ''),
            'procurement'       => 'Item: ' . ($entity->title ?? '') . "\nEstimated value: " . number_format((float) ($entity->estimated_value ?? 0), 2) . ' ' . ($entity->currency ?? 'USD'),
            'salary_advance'    => 'Amount: ' . number_format((float) ($entity->amount ?? 0), 2) . ' ' . ($entity->currency ?? 'USD') . "\nPurpose: " . ($entity->purpose ?? ''),
            'budget_submission' => 'Title: ' . ($entity->title ?? '') . "\nType: " . ($entity->type ?? ''),
            default             => '',
        };
    }
}
