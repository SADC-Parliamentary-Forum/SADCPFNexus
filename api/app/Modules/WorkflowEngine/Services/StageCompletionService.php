<?php

namespace App\Modules\WorkflowEngine\Services;

use App\Models\ApprovalRequest;
use App\Models\ApprovalStep;
use App\Models\WorkflowEngine\WorkflowDecision;
use App\Models\WorkflowEngine\WorkflowTask;
use App\Models\WorkflowEngine\WorkflowVote;

/**
 * Parallel-All / Parallel-Any / Quorum completion rules (PRD §41 / §122).
 */
class StageCompletionService
{
    private const POSITIVE = ['approve', 'recommend', 'certify', 'authorise', 'sign', 'verify', 'acknowledge'];

    public function positiveTypes(): array
    {
        return self::POSITIVE;
    }

    public function recordVote(ApprovalRequest $request, int $stepIndex, int $voterId, string $vote, ?int $decisionId, ?string $comment): WorkflowVote
    {
        return WorkflowVote::updateOrCreate(
            [
                'approval_request_id' => $request->id,
                'step_index' => $stepIndex,
                'voter_user_id' => $voterId,
            ],
            [
                'tenant_id' => $request->tenant_id,
                'workflow_decision_id' => $decisionId,
                'vote' => $vote,
                'comment' => $comment,
                'voted_at' => now(),
            ]
        );
    }

    public function isComplete(ApprovalRequest $request, ApprovalStep $step, int $stepIndex): bool
    {
        $rule = $step->completion_rule ?: 'any';
        $tasks = WorkflowTask::where('approval_request_id', $request->id)
            ->where('step_index', $stepIndex)
            ->whereNotIn('status', ['cancelled'])
            ->get();

        $positiveVotes = WorkflowVote::where('approval_request_id', $request->id)
            ->where('step_index', $stepIndex)
            ->where('vote', 'approve')
            ->count();

        $positiveDecisions = WorkflowDecision::where('approval_request_id', $request->id)
            ->where('step_index', $stepIndex)
            ->whereIn('decision_type', self::POSITIVE)
            ->count();

        $approved = max($positiveVotes, $positiveDecisions);
        $taskCount = max(1, $tasks->count());

        return match ($rule) {
            'all' => $tasks->whereIn('status', ['completed'])->count() >= $tasks->count()
                && $tasks->count() > 0
                && $approved >= $tasks->count(),
            'quorum' => $approved >= max(1, (int) ($step->quorum_count ?? 1)),
            'percentage' => ($approved / $taskCount) * 100 >= (float) ($step->quorum_percentage ?? 50),
            'lead_plus_support' => $approved >= 2,
            default => $approved >= 1, // any / Parallel-Any
        };
    }

    /**
     * Block one actor satisfying multiple segregated parallel roles.
     */
    public function assertParallelSod(ApprovalRequest $request, ApprovalStep $step, int $actorId, int $stepIndex, ?int $currentTaskId = null): void
    {
        if (! $step->sod_segregated) {
            return;
        }

        $priorQuery = WorkflowTask::where('approval_request_id', $request->id)
            ->where('step_index', $stepIndex)
            ->where('assigned_user_id', $actorId)
            ->where('status', 'completed')
            ->whereNotNull('parallel_role_key');
        if ($currentTaskId) {
            $priorQuery->where('id', '!=', $currentTaskId);
        }
        if ($priorQuery->exists()) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'sod' => 'Segregation of duties: one actor cannot satisfy multiple independent parallel roles.',
            ]);
        }

        // Block repeat vote by same actor for a different parallel role
        if (WorkflowVote::where('approval_request_id', $request->id)
            ->where('step_index', $stepIndex)
            ->where('voter_user_id', $actorId)
            ->exists()) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'sod' => 'Segregation of duties: actor already recorded a vote for this parallel stage.',
            ]);
        }
    }
}
