<?php

namespace App\Modules\Audit\Services;

use App\Models\AuditCorrectiveAction;
use App\Models\AuditEngagement;
use App\Models\AuditFinding;
use App\Models\AuditPlan;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AuditAnalyticsService
{
    public function metrics(User $user): array
    {
        $tenantId = $user->tenant_id;

        $rows = AuditEngagement::query()
            ->where('tenant_id', $tenantId)
            ->whereNotNull('actual_start')
            ->whereNotNull('actual_end')
            ->get(['actual_start', 'actual_end']);
        $cycle = $rows->isEmpty()
            ? 0
            : $rows->avg(fn ($e) => $e->actual_start->diffInDays($e->actual_end));

        $ratingDistribution = AuditFinding::query()
            ->where('tenant_id', $tenantId)
            ->select('rating', DB::raw('count(*) as total'))
            ->groupBy('rating')
            ->pluck('total', 'rating')
            ->all();

        $caTotal = AuditCorrectiveAction::where('tenant_id', $tenantId)
            ->whereNotIn('status', ['cancelled'])
            ->count();
        $caOverdue = AuditCorrectiveAction::where('tenant_id', $tenantId)
            ->whereNotIn('status', ['verified_closed', 'cancelled'])
            ->whereDate('due_date', '<', now())
            ->count();

        $plans = AuditPlan::where('tenant_id', $tenantId)->whereIn('status', ['approved', 'amended'])->get();
        $planCompletion = [];
        foreach ($plans as $plan) {
            $total = AuditEngagement::where('audit_plan_id', $plan->id)->count();
            $done = AuditEngagement::where('audit_plan_id', $plan->id)->whereIn('status', ['issued', 'closed'])->count();
            $planCompletion[] = [
                'plan_id' => $plan->id,
                'title' => $plan->title,
                'fiscal_year' => $plan->fiscal_year,
                'completion_pct' => $total === 0 ? 0 : round(($done / $total) * 100, 1),
                'total_engagements' => $total,
                'completed_engagements' => $done,
            ];
        }

        $avgPlanPct = empty($planCompletion)
            ? 0
            : round(collect($planCompletion)->avg('completion_pct'), 1);

        return [
            'cycle_time_days_avg' => round((float) $cycle, 1),
            'rating_distribution' => $ratingDistribution,
            'overdue_corrective_rate' => $caTotal === 0 ? 0 : round(($caOverdue / $caTotal) * 100, 1),
            'overdue_corrective_count' => $caOverdue,
            'plan_completion_pct' => $avgPlanPct,
            'plans' => $planCompletion,
            'open_engagements' => AuditEngagement::where('tenant_id', $tenantId)
                ->whereNotIn('status', ['closed', 'cancelled', 'issued'])->count(),
            'open_findings' => AuditFinding::where('tenant_id', $tenantId)
                ->whereNotIn('status', ['closed', 'draft'])->count(),
        ];
    }
}
