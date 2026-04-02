<?php

namespace App\Modules\Risk\Services;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class RiskDashboardService
{
    public function summary(User $user): array
    {
        $tid = $user->tenant_id;

        // ── KPIs ─────────────────────────────────────────────────────────────

        $base = DB::table('risks')
            ->where('tenant_id', $tid)
            ->whereNull('deleted_at');

        $open    = (clone $base)->whereNotIn('status', ['closed', 'archived'])->count();
        $critical = (clone $base)->where('risk_level', 'critical')->count();
        $high    = (clone $base)->where('risk_level', 'high')->count();
        $escalated = (clone $base)->where('status', 'escalated')->count();

        $reviewsDue = (clone $base)
            ->whereNotIn('status', ['closed', 'archived'])
            ->whereNotNull('next_review_date')
            ->where('next_review_date', '<=', Carbon::now()->addDays(14)->toDateString())
            ->count();

        $overdueActions = DB::table('risk_actions')
            ->join('risks', 'risks.id', '=', 'risk_actions.risk_id')
            ->where('risks.tenant_id', $tid)
            ->whereNull('risks.deleted_at')
            ->where('risk_actions.due_date', '<', now()->toDateString())
            ->where('risk_actions.status', '!=', 'completed')
            ->count();

        // ── By Department ─────────────────────────────────────────────────────

        $risksByDept = DB::table('risks')
            ->leftJoin('departments', 'departments.id', '=', 'risks.department_id')
            ->where('risks.tenant_id', $tid)
            ->whereNull('risks.deleted_at')
            ->select([
                'risks.department_id',
                DB::raw("COALESCE(departments.name, 'No Department') as department_name"),
                DB::raw('COUNT(*) as total'),
                DB::raw("SUM(CASE WHEN risks.risk_level = 'critical' THEN 1 ELSE 0 END) as critical"),
                DB::raw("SUM(CASE WHEN risks.risk_level = 'high' THEN 1 ELSE 0 END) as high"),
            ])
            ->groupBy('risks.department_id', 'departments.name')
            ->get()
            ->keyBy('department_id');

        // Overdue actions per department
        $overdueByDept = DB::table('risk_actions')
            ->join('risks', 'risks.id', '=', 'risk_actions.risk_id')
            ->where('risks.tenant_id', $tid)
            ->whereNull('risks.deleted_at')
            ->where('risk_actions.due_date', '<', now()->toDateString())
            ->where('risk_actions.status', '!=', 'completed')
            ->select([
                'risks.department_id',
                DB::raw('COUNT(*) as overdue_actions'),
            ])
            ->groupBy('risks.department_id')
            ->get()
            ->keyBy('department_id');

        $byDepartment = $risksByDept->map(function ($row) use ($overdueByDept) {
            return [
                'department_id'   => $row->department_id,
                'department_name' => $row->department_name,
                'total'           => (int) $row->total,
                'critical'        => (int) $row->critical,
                'high'            => (int) $row->high,
                'overdue_actions' => (int) ($overdueByDept->get($row->department_id)?->overdue_actions ?? 0),
            ];
        })->values()->toArray();

        // ── Recent Activity ───────────────────────────────────────────────────

        $recentActivity = DB::table('risk_history')
            ->join('risks', 'risks.id', '=', 'risk_history.risk_id')
            ->join('users', 'users.id', '=', 'risk_history.actor_id')
            ->where('risks.tenant_id', $tid)
            ->whereNull('risks.deleted_at')
            ->select([
                'risk_history.id',
                'risk_history.risk_id',
                'risks.risk_code',
                'risk_history.change_type',
                'users.name as actor_name',
                'risk_history.created_at',
            ])
            ->orderByDesc('risk_history.created_at')
            ->limit(10)
            ->get()
            ->map(fn($r) => (array) $r)
            ->toArray();

        // ── Escalated Risks ───────────────────────────────────────────────────

        $escalatedRisks = DB::table('risks')
            ->where('tenant_id', $tid)
            ->whereNull('deleted_at')
            ->where('status', 'escalated')
            ->select(['id', 'risk_code', 'title', 'risk_level', 'escalation_level'])
            ->orderByDesc('created_at')
            ->limit(10)
            ->get()
            ->map(fn($r) => (array) $r)
            ->toArray();

        return [
            'kpis' => [
                'open'            => $open,
                'critical'        => $critical,
                'high'            => $high,
                'overdue_actions' => $overdueActions,
                'escalated'       => $escalated,
                'reviews_due'     => $reviewsDue,
            ],
            'by_department'   => $byDepartment,
            'recent_activity' => $recentActivity,
            'escalated_risks' => $escalatedRisks,
        ];
    }
}
