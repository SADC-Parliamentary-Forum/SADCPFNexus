<?php

namespace App\Modules\Lifecycle\Services;

use App\Models\Lifecycle\LifecycleCase;
use App\Models\Lifecycle\LifecycleException;
use App\Models\Lifecycle\LifecycleTaskInstance;
use App\Models\User;
use Carbon\Carbon;

class LifecycleAnalyticsService
{
    /** @var list<string> */
    public const TYPES = ['onboarding', 'separation', 'transfer', 'promotion', 'probation'];

    public function snapshot(User $user): array
    {
        $tenantId = (int) $user->tenant_id;
        $now = Carbon::now();

        $byType = [];
        foreach (self::TYPES as $type) {
            $base = LifecycleCase::query()->where('tenant_id', $tenantId)->where('lifecycle_type', $type);
            $completedRows = (clone $base)
                ->where('status', 'completed')
                ->whereNotNull('completed_at')
                ->whereNotNull('start_date')
                ->get(['start_date', 'completed_at']);

            $avg = null;
            if ($completedRows->isNotEmpty()) {
                $avg = round($completedRows->avg(function (LifecycleCase $case) {
                    return max(0, $case->start_date->startOfDay()->diffInDays($case->completed_at->startOfDay()));
                }), 1);
            }

            $byType[$type] = [
                'open' => (clone $base)->where('status', 'in_progress')->count(),
                'completed' => (clone $base)->where('status', 'completed')->count(),
                'avg_cycle_days' => $avg,
            ];
        }

        $openTasks = LifecycleTaskInstance::query()
            ->where('tenant_id', $tenantId)
            ->where('status', '!=', 'completed')
            ->whereHas('lifecycleCase', fn ($q) => $q->where('status', 'in_progress'))
            ->get(['task_key', 'title', 'created_at', 'due_date']);

        $bottlenecks = $openTasks
            ->groupBy('task_key')
            ->map(function ($group, $key) use ($now) {
                $ages = $group->map(function (LifecycleTaskInstance $task) use ($now) {
                    $anchor = $task->due_date ?? $task->created_at;

                    return max(0, $anchor->startOfDay()->diffInDays($now->copy()->startOfDay()));
                });

                return [
                    'task_key' => (string) $key,
                    'title' => (string) $group->first()?->title,
                    'open_count' => $group->count(),
                    'avg_age_days' => round((float) $ages->avg(), 1),
                ];
            })
            ->sortByDesc('avg_age_days')
            ->take(8)
            ->values()
            ->all();

        $separations = LifecycleCase::query()
            ->where('tenant_id', $tenantId)
            ->where('lifecycle_type', 'separation')
            ->where('status', 'in_progress')
            ->get(['created_at', 'start_date']);

        $aging = ['0_7' => 0, '8_14' => 0, '15_plus' => 0];
        foreach ($separations as $case) {
            $anchor = $case->start_date ?? $case->created_at;
            $days = max(0, $anchor->startOfDay()->diffInDays($now->copy()->startOfDay()));
            if ($days <= 7) {
                $aging['0_7']++;
            } elseif ($days <= 14) {
                $aging['8_14']++;
            } else {
                $aging['15_plus']++;
            }
        }

        return [
            'by_type' => $byType,
            'bottlenecks' => $bottlenecks,
            'clearance_aging' => $aging,
            'exceptions_open' => LifecycleException::query()
                ->where('tenant_id', $tenantId)
                ->where('status', '!=', 'approved')
                ->count(),
        ];
    }
}
