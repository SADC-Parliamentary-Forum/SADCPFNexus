<?php

namespace App\Services;

use App\Models\ApprovalHistory;
use App\Models\ApprovalRequest;
use App\Models\ApprovalStep;
use App\Models\ApprovalWorkflow;
use App\Models\Department;
use App\Models\User;
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
     */
    public function approve(ApprovalRequest $request, User $actor, ?string $comment = null): void
    {
        $this->verifyActorCanApprove($request, $actor);

        $advancedToStep = null;

        DB::transaction(function () use ($request, $actor, $comment, &$advancedToStep) {
            ApprovalHistory::create([
                'approval_request_id' => $request->id,
                'user_id'             => $actor->id,
                'action'              => 'approve',
                'comment'             => $comment,
            ]);

            $workflow = $request->workflow;
            $nextStepIndex = $request->current_step_index + 1;

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

        // Notify next-step approvers AFTER the transaction commits (so queued
        // jobs don't run against uncommitted data).
        if ($advancedToStep !== null) {
            $request->refresh();
            $this->notifyApprovers($request);
        }
    }

    /**
     * Handle a rejection action.
     */
    public function reject(ApprovalRequest $request, User $actor, string $comment): void
    {
        $this->verifyActorCanApprove($request, $actor);

        DB::transaction(function () use ($request, $actor, $comment) {
            ApprovalHistory::create([
                'approval_request_id' => $request->id,
                'user_id'             => $actor->id,
                'action'              => 'reject',
                'comment'             => $comment,
            ]);

            $request->update(['status' => 'rejected']);
            $this->finalizeApprovable($request, 'rejected', $actor, $comment);
        });
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

        if ($status === 'approved') {
            // This is a generic way to call methods on the model
            if (method_exists($entity, 'onWorkflowApproved')) {
                $entity->onWorkflowApproved($actor);
            } else {
                $entity->update(['status' => 'approved', 'approved_by' => $actor->id, 'approved_at' => now()]);
            }
        } else {
            if (method_exists($entity, 'onWorkflowRejected')) {
                $entity->onWorkflowRejected($actor, $reason);
            } else {
                $entity->update(['status' => 'rejected', 'rejection_reason' => $reason]);
            }
        }

        // Notify HR staff and Directors about the final outcome
        $this->notifyHrOnCompletion($request, $status, $actor);
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
     */
    private function notifyApprovers(ApprovalRequest $request): void
    {
        try {
            $approvers = $this->getCurrentApprovers($request);
            if (empty($approvers)) {
                return;
            }

            $entity    = $request->approvable;
            $requester = $this->getRequesterFromApprovable($request);
            $module    = $this->resolveModuleType($request);
            $label     = self::MODULE_LABELS[$module] ?? ucfirst(str_replace('_', ' ', $module));

            // Build a brief human-readable summary of the request
            $summary = $this->buildSummary($entity, $module);

            foreach ($approvers as $approver) {
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
