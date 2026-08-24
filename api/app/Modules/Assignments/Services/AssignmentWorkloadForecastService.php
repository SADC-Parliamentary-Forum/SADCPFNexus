<?php

namespace App\Modules\Assignments\Services;

use App\Models\Assignment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AssignmentWorkloadForecastService
{
    public function forecast(User $viewer, int $weeks = 4, ?int $departmentId = null): array
    {
        $weeks = max(1, min(26, $weeks));
        $availablePerAssignee = 40 * $weeks;
        $deptId = $departmentId ?: $viewer->department_id;

        $query = Assignment::query()
            ->where('tenant_id', $viewer->tenant_id)
            ->where('is_template', false)
            ->whereNotNull('assigned_to')
            ->whereNotIn('status', ['closed', 'cancelled']);

        if ($deptId) {
            $query->where('department_id', $deptId);
        } elseif (! $viewer->hasAnyRole(['System Admin', 'Secretary General', 'HR Manager', 'HR Administrator'])) {
            $query->where('assigned_to', $viewer->id);
        }

        $rows = $query
            ->select([
                'assigned_to',
                DB::raw('count(*) as open_count'),
                DB::raw('coalesce(sum(coalesce(estimated_hours, 8)), 0) as estimated_hours_total'),
            ])
            ->groupBy('assigned_to')
            ->get();

        $users = User::query()
            ->whereIn('id', $rows->pluck('assigned_to')->filter()->all())
            ->get(['id', 'name', 'department_id', 'job_title'])
            ->keyBy('id');

        $assignees = $rows->map(function ($row) use ($users, $availablePerAssignee) {
            $hours = (float) $row->estimated_hours_total;
            $util = $availablePerAssignee > 0 ? round(($hours / $availablePerAssignee) * 100, 1) : 0;
            $band = match (true) {
                $util >= 110 => 'critical',
                $util >= 90 => 'high',
                $util >= 70 => 'medium',
                default => 'low',
            };

            return [
                'user_id' => (int) $row->assigned_to,
                'name' => $users[$row->assigned_to]->name ?? 'Unknown',
                'job_title' => $users[$row->assigned_to]->job_title ?? null,
                'department_id' => $users[$row->assigned_to]->department_id ?? null,
                'open_count' => (int) $row->open_count,
                'estimated_hours_total' => $hours,
                'available_hours' => $availablePerAssignee,
                'utilization_pct' => $util,
                'load_band' => $band,
            ];
        })->sortByDesc('utilization_pct')->values()->all();

        return [
            'weeks' => $weeks,
            'department_id' => $deptId,
            'surveillance_ranking' => false,
            'assignees' => $assignees,
            'summary' => [
                'assignee_count' => count($assignees),
                'open_total' => array_sum(array_column($assignees, 'open_count')),
                'hours_total' => array_sum(array_column($assignees, 'estimated_hours_total')),
                'highest_utilization_pct' => $assignees[0]['utilization_pct'] ?? 0,
            ],
        ];
    }
}
