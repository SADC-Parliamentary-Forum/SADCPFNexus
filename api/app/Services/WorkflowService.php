<?php

namespace App\Services;

use App\Models\ApprovalHistory;
use App\Models\ApprovalRequest;
use App\Models\ApprovalStep;
use App\Models\ApprovalWorkflow;
use App\Models\Department;
use App\Models\User;
use App\Models\WorkflowDelegation;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class WorkflowService
{
    /** Human-readable labels for each module type. */
    private const MODULE_LABELS = [
        'travel'         => 'Travel',
        'leave'          => 'Leave',
        'imprest'        => 'Imprest',
        'procurement'    => 'Procurement',
        'salary_advance' => 'Salary Advance',
        'timesheet'      => 'Timesheet',
    ];

    public function __construct(
        protected NotificationService $notificationService,
        protected SignedTokenService  $signedTokenService,
    ) {}

    /**
     * Start a workflow for an approvable entity.
     */
    public function initiate(Model $entity, string $moduleType, User $requester): ?ApprovalRequest
    {
        $workflow = ApprovalWorkflow::where('module_type', $moduleType)
            ->where('tenant_id', $requester->tenant_id)
            ->where('is_active', true)
            ->first();

        if (!$workflow) {
            return null;
        }

        $request = ApprovalRequest::create([
            'tenant_id'       => $requester->tenant_id,
            'approvable_type' => get_class($entity),
            'approvable_id'   => $entity->id,
            'workflow_id'     => $workflow->id,
            'current_step_index' => 0,
            'status'          => 'pending',
        ]);

        // Notify the first-step approvers (with email action buttons)
        $this->notifyApprovers($request);

        return $request;
    }

    /**
     * Handle an approval action.
     *
     * Returns ['advanced_to_step' => int|null, 'notified_approvers' => string[]]
     * so controllers can include the notified role labels in the JSON response (sequential toast).
     */
    public function approve(ApprovalRequest $request, User $actor, ?string $comment = null): array
    {
        $this->verifyActorCanApprove($request, $actor);

        $stepIndexBefore = $request->current_step_index;
        $advancedToStep  = null;

        DB::transaction(function () use ($request, $actor, $comment, $stepIndexBefore, &$advancedToStep) {
            ApprovalHistory::create([
                'approval_request_id' => $request->id,
                'user_id'             => $actor->id,
                'action'              => 'approve',
                'step_index'          => $stepIndexBefore,
                'comment'             => $comment,
            ]);

            $workflow      = $request->workflow;
            $nextStepIndex = $stepIndexBefore + 1;

            if ($nextStepIndex >= $workflow->steps()->count()) {
                // Workflow complete
                $request->update(['status' => 'approved']);
                $this->finalizeApprovable($request, 'approved', $actor);
            } else {
                // Move to next step
                $request->update(['current_step_index' => $nextStepIndex]);
                $advancedToStep = $nextStepIndex;
            }
        });

        $notifiedApprovers = [];

        // Notify next-step approvers AFTER the transaction commits (so queued
        // jobs don't run against uncommitted data).
        if ($advancedToStep !== null) {
            $request->refresh();
            $notifiedApprovers = $this->notifyApprovers($request);
        }

        return [
            'advanced_to_step'   => $advancedToStep,
            'notified_approvers' => $notifiedApprovers,
        ];
    }

    /**
     * Handle a rejection action.
     */
    public function reject(ApprovalRequest $request, User $actor, string $comment): void
    {
        $this->verifyActorCanApprove($request, $actor);

        $stepIndexBefore = $request->current_step_index;

        DB::transaction(function () use ($request, $actor, $comment, $stepIndexBefore) {
            ApprovalHistory::create([
                'approval_request_id' => $request->id,
                'user_id'             => $actor->id,
                'action'              => 'reject',
                'step_index'          => $stepIndexBefore,
                'comment'             => $comment,
            ]);

            $request->update(['status' => 'rejected']);
            $this->finalizeApprovable($request, 'rejected', $actor, $comment);
        });
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

        DB::transaction(function () use ($request, $actor) {
            ApprovalHistory::create([
                'approval_request_id' => $request->id,
                'user_id'             => $actor->id,
                'action'              => 'resubmit',
                'step_index'          => 0,
            ]);

            $request->update([
                'status'             => 'pending',
                'current_step_index' => 0,
            ]);

            $this->finalizeApprovable($request, 'resubmitted', $actor);
        });

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
        $id = $entity->requester_id ?? $entity->created_by ?? null;

        return $id ? User::find($id) : null;
    }

    /**
     * Get the current approver(s) for a request.
     */
    public function getCurrentApprovers(ApprovalRequest $request): array
    {
        $step = $request->workflow->steps->get($request->current_step_index);

        if (!$step) {
            return [];
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
                // Logic to find supervisor, but if already approved by one, find their supervisor
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
        $approvers = $this->getCurrentApprovers($request);
        $approverIds = collect($approvers)->pluck('id')->toArray();

        // System Admin bypass or specific check
        if (!$actor->isSystemAdmin() && !in_array($actor->id, $approverIds)) {
            throw ValidationException::withMessages(['approval' => 'You are not authorized to approve this request at this stage.']);
        }

        // No self-approval: requester cannot approve their own request, except Secretary General at final step (after workflow has been followed).
        $requester = $this->getRequesterFromApprovable($request);
        if ($requester && (int) $requester->id === (int) $actor->id) {
            $isSecretaryGeneralAtFinalStep = $actor->isSecretaryGeneral()
                && $request->current_step_index >= 1;
            if (!$isSecretaryGeneralAtFinalStep) {
                throw ValidationException::withMessages([
                    'approval' => 'You cannot approve your own request. Requests must go through the workflow before the Secretary General approves.',
                ]);
            }
        }
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
                    $urls = $this->signedTokenService->createPair($request, $approver);

                    $vars = [
                        'name'         => $approver->name,
                        'module_label' => $label,
                        'reference'    => $entity->reference_number ?? "#{$request->id}",
                        'requester'    => $requester?->name ?? 'A staff member',
                        'summary'      => $summary,
                    ];

                    $meta = [
                        'module'      => $module,
                        'record_id'   => $entity->id,
                        'url'         => "/{$module}/" . ($entity->id ?? ''),
                        'approve_url' => $urls['approve_url'],
                        'reject_url'  => $urls['reject_url'],
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

            $urls = $this->signedTokenService->createPair($request, $delegateTo);

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
                    'module'      => $module,
                    'record_id'   => $entity->id,
                    'url'         => "/{$module}/" . $entity->id,
                    'approve_url' => $urls['approve_url'],
                    'reject_url'  => $urls['reject_url'],
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
        ];

        return $map[$type] ?? strtolower(class_basename($type));
    }

    private function buildSummary(?object $entity, string $module): string
    {
        if (!$entity) {
            return '';
        }

        return match ($module) {
            'travel'         => 'Destination: ' . ($entity->destination_city ?? '') . ', ' . ($entity->destination_country ?? '') . "\nDeparture: " . ($entity->departure_date ?? ''),
            'leave'          => 'Type: ' . ($entity->leave_type ?? '') . "\nFrom: " . ($entity->start_date ?? '') . ' to ' . ($entity->end_date ?? ''),
            'imprest'        => 'Amount: ' . number_format((float) ($entity->amount_requested ?? 0), 2) . ' ' . ($entity->currency ?? 'USD') . "\nPurpose: " . ($entity->purpose ?? ''),
            'procurement'    => 'Item: ' . ($entity->title ?? '') . "\nEstimated value: " . number_format((float) ($entity->estimated_value ?? 0), 2) . ' ' . ($entity->currency ?? 'USD'),
            'salary_advance' => 'Amount: ' . number_format((float) ($entity->amount ?? 0), 2) . ' ' . ($entity->currency ?? 'USD') . "\nPurpose: " . ($entity->purpose ?? ''),
            default          => '',
        };
    }
}
