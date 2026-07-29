<?php

namespace App\Modules\Assignments\Services;

use App\Models\Assignment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AssignmentCapacityService
{
    private const PRIORITY_WEIGHT = [
        'critical' => 5,
        'urgent' => 4,
        'high' => 3,
        'medium' => 2,
        'low' => 1,
    ];

    public function capacity(User $viewer, ?int $departmentId = null): array
    {
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
                DB::raw("sum(case when due_date < current_date then 1 else 0 end) as overdue_count"),
                DB::raw("sum(case when priority = 'critical' then 5 when priority = 'urgent' then 4 when priority = 'high' then 3 when priority = 'medium' then 2 else 1 end) as load_score"),
            ])
            ->groupBy('assigned_to')
            ->get();

        $users = User::query()
            ->whereIn('id', $rows->pluck('assigned_to')->filter()->all())
            ->get(['id', 'name', 'department_id', 'job_title'])
            ->keyBy('id');

        $assignees = $rows->map(function ($row) use ($users) {
            $score = (int) $row->load_score;
            $band = match (true) {
                $score >= 12 => 'critical',
                $score >= 8 => 'high',
                $score >= 4 => 'medium',
                default => 'low',
            };

            return [
                'user_id' => (int) $row->assigned_to,
                'name' => $users[$row->assigned_to]->name ?? 'Unknown',
                'job_title' => $users[$row->assigned_to]->job_title ?? null,
                'department_id' => $users[$row->assigned_to]->department_id ?? null,
                'open_count' => (int) $row->open_count,
                'overdue_count' => (int) $row->overdue_count,
                'load_score' => $score,
                'load_band' => $band,
            ];
        })->sortByDesc('load_score')->values()->all();

        return [
            'department_id' => $deptId,
            'assignees' => $assignees,
            'summary' => [
                'assignee_count' => count($assignees),
                'open_total' => array_sum(array_column($assignees, 'open_count')),
                'overdue_total' => array_sum(array_column($assignees, 'overdue_count')),
                'highest_load_score' => $assignees[0]['load_score'] ?? 0,
            ],
        ];
    }
}
