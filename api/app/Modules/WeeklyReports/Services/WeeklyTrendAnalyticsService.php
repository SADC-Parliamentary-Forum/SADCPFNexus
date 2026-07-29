<?php

namespace App\Modules\WeeklyReports\Services;

use App\Models\User;
use App\Models\WeeklyReport;
use Carbon\Carbon;

class WeeklyTrendAnalyticsService
{
    public function trends(User $viewer, ?string $from = null, ?string $to = null): array
    {
        $fromDt = Carbon::parse($from ?: now()->subWeeks(12)->toDateString())->startOfDay();
        $toDt = Carbon::parse($to ?: now()->toDateString())->endOfDay();

        $query = WeeklyReport::query()
            ->where('tenant_id', $viewer->tenant_id)
            ->whereBetween('created_at', [$fromDt, $toDt]);

        if (! $viewer->isSystemAdmin() && ! $viewer->can('weekly-reports.admin')) {
            $query->where(function ($q) use ($viewer) {
                $q->where('employee_id', $viewer->id)
                    ->orWhere('supervisor_id', $viewer->id)
                    ->orWhere('owner_id', $viewer->id);
            });
        }

        $all = $query->get(['id', 'status', 'created_at', 'employee_due_at']);
        $grouped = [];
        foreach ($all as $r) {
            $week = $r->created_at->copy()->startOfWeek()->toDateString();
            if (! isset($grouped[$week])) {
                $grouped[$week] = [
                    'week_start' => $week,
                    'total' => 0,
                    'completed' => 0,
                    'missing_or_late' => 0,
                ];
            }
            $grouped[$week]['total']++;
            if (in_array($r->status, ['submitted', 'accepted', 'published', 'reviewed'], true)) {
                $grouped[$week]['completed']++;
            }
            $lateDraft = in_array($r->status, ['draft', 'not_started'], true)
                && $r->employee_due_at
                && $r->employee_due_at->isPast();
            if (in_array($r->status, ['not_started', 'missing'], true) || $lateDraft) {
                $grouped[$week]['missing_or_late']++;
            }
        }

        ksort($grouped);
        $series = [];
        foreach ($grouped as $s) {
            $s['completion_rate'] = $s['total'] > 0
                ? round(($s['completed'] / $s['total']) * 100, 1)
                : 0;
            $series[] = $s;
        }

        $total = array_sum(array_column($series, 'total'));
        $completed = array_sum(array_column($series, 'completed'));

        return [
            'from' => $fromDt->toDateString(),
            'to' => $toDt->toDateString(),
            'series' => $series,
            'summary' => [
                'total_reports' => $total,
                'completed' => $completed,
                'completion_rate' => $total > 0 ? round(($completed / $total) * 100, 1) : 0,
                'missing_or_late' => array_sum(array_column($series, 'missing_or_late')),
            ],
        ];
    }
}
