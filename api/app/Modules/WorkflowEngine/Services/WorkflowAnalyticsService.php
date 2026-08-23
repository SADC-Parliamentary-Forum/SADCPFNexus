<?php

namespace App\Modules\WorkflowEngine\Services;

use App\Models\ApprovalHistory;
use App\Models\ApprovalRequest;
use App\Models\PeopleAuthority\IdentityAuditEvent;
use App\Models\User;
use App\Models\WorkflowEngine\WorkflowDecision;
use App\Models\WorkflowEngine\WorkflowTask;
use App\Models\WorkflowDelegation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Advanced workflow analytics — cycle time, bottlenecks, rates (PRD §94 / §122).
 * Not employee leaderboards / surveillance rankings.
 */
class WorkflowAnalyticsService
{
    public function summary(int $tenantId, array $filters = []): array
    {
        $since = $filters['since'] ?? now()->subDays(90);

        $completed = ApprovalRequest::where('tenant_id', $tenantId)
            ->whereIn('status', ['approved', 'rejected'])
            ->where('updated_at', '>=', $since)
            ->get();

        $cycleHours = $completed->map(function (ApprovalRequest $r) {
            if (! $r->created_at || ! $r->completed_at) {
                return null;
            }

            return $r->created_at->diffInMinutes($r->completed_at) / 60;
        })->filter()->values();

        $stageStats = $this->stageStats($tenantId, $since);

        $history = ApprovalHistory::query()
            ->whereHas('request', fn ($q) => $q->where('tenant_id', $tenantId))
            ->where('created_at', '>=', $since)
            ->get();

        $totalDecisions = 1;
        $rejects = $history->where('action', 'reject')->count();
        $returns = $history->where('action', 'return')->count();

        if (Schema::hasTable('workflow_decisions')) {
            $totalDecisions = max(1, WorkflowDecision::where('tenant_id', $tenantId)->where('decided_at', '>=', $since)->count());
        }

        $delegationUsage = 0;
        if (Schema::hasTable('workflow_delegations')) {
            $delegationUsage = WorkflowDelegation::whereHas('approvalRequest', fn ($q) => $q->where('tenant_id', $tenantId))
                ->where('created_at', '>=', $since)
                ->count();
        }

        $exceptions = 0;
        if (Schema::hasColumn('approval_requests', 'held_at')) {
            $exceptions = ApprovalRequest::where('tenant_id', $tenantId)
                ->whereNotNull('held_at')
                ->where('updated_at', '>=', $since)
                ->count();
        }

        $selfApprovedCount = 0;
        if (Schema::hasTable('identity_audit_events')) {
            $selfApprovedCount = IdentityAuditEvent::where('tenant_id', $tenantId)
                ->where('event_type', 'authority.check.self_approval_allowed')
                ->where('created_at', '>=', $since)
                ->count();
        }

        $actingAuthorityApprovals = 0;
        if (Schema::hasTable('workflow_decisions') && Schema::hasColumn('workflow_decisions', 'acting_appointment_snapshot')) {
            $actingAuthorityApprovals = WorkflowDecision::where('tenant_id', $tenantId)
                ->where('decided_at', '>=', $since)
                ->whereNotNull('acting_appointment_snapshot')
                ->count();
        }

        $stageRows = $this->normalizeStageStats($stageStats);

        return [
            'window_since' => is_string($since) ? $since : $since->toIso8601String(),
            'completed_count' => $completed->count(),
            'avg_cycle_hours' => round((float) $cycleHours->avg(), 2),
            'median_cycle_hours' => round((float) $this->median($cycleHours->all()), 2),
            'stage_cycle_times' => $stageRows,
            'bottlenecks' => array_slice($stageRows, 0, 5),
            'overdue_rate' => $this->rate(
                collect($stageRows)->sum(fn ($s) => (int) ($s['overdue_count'] ?? 0)),
                max(1, collect($stageRows)->sum(fn ($s) => (int) ($s['task_count'] ?? 0)))
            ),
            'return_rate' => $this->rate($returns, $totalDecisions),
            'reject_rate' => $this->rate($rejects, $totalDecisions),
            'delegation_usage' => $delegationUsage,
            'exceptions_held' => $exceptions,
            'self_approved_count' => $selfApprovedCount,
            'acting_authority_approvals' => $actingAuthorityApprovals,
            'note' => 'Aggregate process metrics only — not individual performance rankings.',
        ];
    }

    private function stageStats(int $tenantId, $since)
    {
        if (! Schema::hasTable('workflow_tasks')) {
            return collect();
        }

        if (DB::getDriverName() !== 'sqlite') {
            try {
                $stats = WorkflowTask::query()
                    ->select('step_index', 'stage_type')
                    ->selectRaw('AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - assigned_at))/3600) as avg_hours')
                    ->selectRaw('COUNT(*) as task_count')
                    ->selectRaw("SUM(CASE WHEN due_at IS NOT NULL AND completed_at IS NOT NULL AND completed_at > due_at THEN 1 WHEN due_at IS NOT NULL AND completed_at IS NULL AND due_at < NOW() THEN 1 ELSE 0 END) as overdue_count")
                    ->where('tenant_id', $tenantId)
                    ->where('assigned_at', '>=', $since)
                    ->groupBy('step_index', 'stage_type')
                    ->orderByDesc('avg_hours')
                    ->limit(20)
                    ->get();

                if ($stats->isNotEmpty()) {
                    return $stats;
                }
            } catch (\Throwable) {
                // Fall through to PHP aggregation when SQL analytics are unavailable.
            }
        }

        return WorkflowTask::where('tenant_id', $tenantId)
            ->where('assigned_at', '>=', $since)
            ->get()
            ->groupBy(fn ($t) => $t->step_index.'|'.$t->stage_type)
            ->map(function ($group, $key) {
                [$step, $type] = explode('|', $key, 2);
                $hours = $group->map(function ($t) {
                    if (! $t->assigned_at) {
                        return null;
                    }
                    $end = $t->completed_at ?: now();

                    return $t->assigned_at->diffInMinutes($end) / 60;
                })->filter();

                return (object) [
                    'step_index' => (int) $step,
                    'stage_type' => $type,
                    'avg_hours' => $hours->avg(),
                    'task_count' => $group->count(),
                    'overdue_count' => $group->filter(fn ($t) => $t->isOverdue() || ($t->due_at && $t->completed_at && $t->completed_at->gt($t->due_at)))->count(),
                ];
            })
            ->sortByDesc('avg_hours')
            ->values();
    }

    /** @return list<array{step_index: int, stage_type: string, avg_hours: float|null, task_count: int, overdue_count: int}> */
    private function normalizeStageStats($stageStats): array
    {
        return collect($stageStats)->map(function ($stage) {
            return [
                'step_index' => (int) ($stage->step_index ?? 0),
                'stage_type' => (string) ($stage->stage_type ?? 'unknown'),
                'avg_hours' => $stage->avg_hours === null ? null : round((float) $stage->avg_hours, 2),
                'task_count' => (int) ($stage->task_count ?? 0),
                'overdue_count' => (int) ($stage->overdue_count ?? 0),
            ];
        })->values()->all();
    }

    private function rate(int $num, int $den): float
    {
        return round(($num / max(1, $den)) * 100, 2);
    }

    private function median(array $values): float
    {
        if ($values === []) {
            return 0.0;
        }
        sort($values);
        $c = count($values);
        $mid = intdiv($c, 2);

        return $c % 2 ? (float) $values[$mid] : ((float) $values[$mid - 1] + (float) $values[$mid]) / 2;
    }
}
