<?php

namespace App\Modules\WorkflowEngine\Services;

use App\Models\ApprovalHistory;
use App\Models\ApprovalRequest;
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

        $stageStats = WorkflowTask::query()
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

        // SQLite-friendly fallback when EXTRACT unsupported
        if ($stageStats->isEmpty() || DB::getDriverName() === 'sqlite') {
            $stageStats = WorkflowTask::where('tenant_id', $tenantId)
                ->where('assigned_at', '>=', $since)
                ->get()
                ->groupBy(fn ($t) => $t->step_index.'|'.$t->stage_type)
                ->map(function ($group, $key) {
                    [$step, $type] = explode('|', $key);
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

        $history = ApprovalHistory::query()
            ->whereHas('request', fn ($q) => $q->where('tenant_id', $tenantId))
            ->where('created_at', '>=', $since)
            ->get();

        $totalDecisions = max(1, WorkflowDecision::where('tenant_id', $tenantId)->where('decided_at', '>=', $since)->count());
        $rejects = $history->where('action', 'reject')->count();
        $returns = $history->where('action', 'return')->count();

        $delegationUsage = 0;
        if (Schema::hasTable('workflow_delegations')) {
            $delegationUsage = WorkflowDelegation::whereHas('approvalRequest', fn ($q) => $q->where('tenant_id', $tenantId))
                ->where('created_at', '>=', $since)
                ->count();
        }

        $exceptions = ApprovalRequest::where('tenant_id', $tenantId)
            ->whereNotNull('held_at')
            ->where('updated_at', '>=', $since)
            ->count();

        return [
            'window_since' => is_string($since) ? $since : $since->toIso8601String(),
            'completed_count' => $completed->count(),
            'avg_cycle_hours' => round((float) $cycleHours->avg(), 2),
            'median_cycle_hours' => round((float) $this->median($cycleHours->all()), 2),
            'stage_cycle_times' => $stageStats,
            'bottlenecks' => collect($stageStats)->take(5)->values(),
            'overdue_rate' => $this->rate(
                collect($stageStats)->sum(fn ($s) => (int) ($s->overdue_count ?? 0)),
                max(1, collect($stageStats)->sum(fn ($s) => (int) ($s->task_count ?? 0)))
            ),
            'return_rate' => $this->rate($returns, $totalDecisions),
            'reject_rate' => $this->rate($rejects, $totalDecisions),
            'delegation_usage' => $delegationUsage,
            'exceptions_held' => $exceptions,
            'note' => 'Aggregate process metrics only — not individual performance rankings.',
        ];
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
