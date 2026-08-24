<?php

namespace App\Modules\Timesheets\Services;

use App\Models\Timesheet;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Hours booked vs expected — not a performance score and not invented OT rates.
 */
class TimesheetCapacityAnalyticsService
{
    public function analytics(User $viewer, string $weekStart, string $weekEnd, ?int $departmentId = null): array
    {
        $start = Carbon::parse($weekStart)->toDateString();
        $end = Carbon::parse($weekEnd)->toDateString();
        $deptId = $departmentId ?: $viewer->department_id;

        $query = Timesheet::query()
            ->with('user:id,name,department_id,job_title')
            ->where('tenant_id', $viewer->tenant_id)
            ->whereDate('week_start', '>=', $start)
            ->whereDate('week_end', '<=', $end);

        if ($deptId && ! $viewer->hasAnyRole(['System Admin', 'Secretary General', 'HR Manager', 'HR Administrator'])) {
            $query->whereHas('user', fn ($q) => $q->where('department_id', $deptId));
        } elseif ($deptId) {
            $query->whereHas('user', fn ($q) => $q->where('department_id', $deptId));
        }

        $rows = $query->get()->groupBy('user_id')->map(function ($sheets, $userId) {
            $first = $sheets->first();
            $recorded = (float) $sheets->sum('total_hours');
            $expected = (float) $sheets->sum(fn ($s) => (float) ($s->expected_hours ?? 40));
            $util = $expected > 0 ? round(($recorded / $expected) * 100, 1) : 0;

            return [
                'user_id' => (int) $userId,
                'name' => $first->user?->name ?? 'Unknown',
                'job_title' => $first->user?->job_title ?? null,
                'department_id' => $first->user?->department_id,
                'timesheet_count' => $sheets->count(),
                'recorded_hours' => $recorded,
                'expected_hours' => $expected,
                'utilization_pct' => $util,
                'statuses' => $sheets->pluck('status')->unique()->values()->all(),
            ];
        })->sortByDesc('utilization_pct')->values()->all();

        return [
            'week_start' => $start,
            'week_end' => $end,
            'department_id' => $deptId,
            'invented_ot_rates' => false,
            'biometric' => false,
            'csv_columns' => ['name', 'recorded_hours', 'expected_hours', 'utilization_pct'],
            'people' => $rows,
            'summary' => [
                'people_count' => count($rows),
                'recorded_hours_total' => array_sum(array_column($rows, 'recorded_hours')),
                'expected_hours_total' => array_sum(array_column($rows, 'expected_hours')),
            ],
        ];
    }
}
