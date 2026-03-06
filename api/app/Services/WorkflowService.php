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

class WorkflowService
{
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

        return $request;
    }

    /**
     * Handle an approval action.
     */
    public function approve(ApprovalRequest $request, User $actor, ?string $comment = null): void
    {
        $this->verifyActorCanApprove($request, $actor);

        DB::transaction(function () use ($request, $actor, $comment) {
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
            }
        });
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
     * Get the current approver(s) for a request.
     */
    public function getCurrentApprovers(ApprovalRequest $request): array
    {
        $step = $request->workflow->steps->get($request->current_step_index);
        
        if (!$step) return [];

        $requester = $request->approvable->requester; // Assuming entities have a requester relationship

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
        if (!$actor->hasRole('System Admin') && !in_array($actor->id, $approverIds)) {
            throw ValidationException::withMessages(['approval' => 'You are not authorized to approve this request at this stage.']);
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
}
