<?php

namespace App\Modules\Risk\Services;

use App\Models\Risk;
use App\Models\RiskAction;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class RiskMatrixService
{
    public function matrix(User $user, array $filters = []): array
    {
        $excludeClosed = $filters['exclude_closed'] ?? true;

        // Base query scope
        $baseQuery = DB::table('risks')
            ->where('tenant_id', $user->tenant_id)
            ->whereNull('deleted_at');

        if ($excludeClosed) {
            $baseQuery->whereNotIn('status', ['closed', 'archived']);
        }

        // Build the 5×5 matrix using aggregate SQL
        $cellData = (clone $baseQuery)
            ->select(
                'likelihood',
                'impact',
                DB::raw('COUNT(*) as count'),
                DB::raw("STRING_AGG(id::text, ',') as risk_ids_str")
            )
            ->groupBy('likelihood', 'impact')
            ->get()
            ->keyBy(fn($row) => "{$row->likelihood}_{$row->impact}");

        $cells = [];
        for ($l = 1; $l <= 5; $l++) {
            for ($i = 1; $i <= 5; $i++) {
                $score  = $l * $i;
                $zone   = Risk::computeRiskLevel($score);
                $key    = "{$l}_{$i}";
                $row    = $cellData->get($key);
                $riskIds = [];
                if ($row && $row->risk_ids_str) {
                    $riskIds = array_map('intval', explode(',', $row->risk_ids_str));
                }
                $cells[] = [
                    'likelihood' => $l,
                    'impact'     => $i,
                    'score'      => $score,
                    'zone'       => $zone,
                    'count'      => $row ? (int) $row->count : 0,
                    'risk_ids'   => $riskIds,
                ];
            }
        }

        // By status (all, not excluding closed)
        $allQuery = DB::table('risks')
            ->where('tenant_id', $user->tenant_id)
            ->whereNull('deleted_at');

        $byStatus = $allQuery->select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')
            ->get()
            ->pluck('count', 'status')
            ->map(fn($v) => (int) $v)
            ->toArray();

        // Ensure all statuses are represented
        foreach (['draft', 'submitted', 'reviewed', 'approved', 'monitoring', 'escalated', 'closed', 'archived'] as $s) {
            $byStatus[$s] ??= 0;
        }

        // By risk level
        $byRiskLevel = (clone $allQuery)->select('risk_level', DB::raw('COUNT(*) as count'))
            ->groupBy('risk_level')
            ->get()
            ->pluck('count', 'risk_level')
            ->map(fn($v) => (int) $v)
            ->toArray();

        foreach (['low', 'medium', 'high', 'critical'] as $level) {
            $byRiskLevel[$level] ??= 0;
        }

        // By category
        $byCategory = (clone $allQuery)->select('category', DB::raw('COUNT(*) as count'))
            ->groupBy('category')
            ->get()
            ->pluck('count', 'category')
            ->map(fn($v) => (int) $v)
            ->toArray();

        foreach (['strategic', 'operational', 'financial', 'compliance', 'reputational', 'security', 'other'] as $cat) {
            $byCategory[$cat] ??= 0;
        }

        // Totals
        $total = (clone $allQuery)->count();
        $open  = (clone $allQuery)->whereNotIn('status', ['closed', 'archived'])->count();

        $overdueActions = DB::table('risk_actions')
            ->join('risks', 'risks.id', '=', 'risk_actions.risk_id')
            ->where('risks.tenant_id', $user->tenant_id)
            ->whereNull('risks.deleted_at')
            ->whereNotNull('risk_actions.due_date')
            ->where('risk_actions.due_date', '<', now()->toDateString())
            ->where('risk_actions.status', '!=', 'completed')
            ->count();

        return [
            'cells'         => $cells,
            'by_status'     => $byStatus,
            'by_risk_level' => $byRiskLevel,
            'by_category'   => $byCategory,
            'totals'        => [
                'total'           => (int) $total,
                'open'            => (int) $open,
                'overdue_actions' => (int) $overdueActions,
            ],
        ];
    }
}
