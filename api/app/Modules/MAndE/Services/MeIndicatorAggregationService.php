<?php

namespace App\Modules\MAndE\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class MeIndicatorAggregationService
{
    public function aggregate(User $user, ?int $frameworkId = null): array
    {
        $tid = $user->tenant_id;
        if (! Schema::hasTable('indicators')) {
            return [
                'by_framework' => [],
                'totals' => ['indicators' => 0, 'with_targets' => 0, 'with_actuals' => 0],
            ];
        }

        $query = DB::table('indicators')->where('tenant_id', $tid);
        if ($frameworkId) {
            $query->where('results_framework_id', $frameworkId);
        }

        $total = (clone $query)->count();
        $withTargets = Schema::hasColumn('indicators', 'target_value')
            ? (clone $query)->whereNotNull('target_value')->count()
            : 0;
        $withActuals = Schema::hasColumn('indicators', 'latest_actual')
            ? (clone $query)->whereNotNull('latest_actual')->count()
            : (Schema::hasColumn('indicators', 'actual_value')
                ? (clone $query)->whereNotNull('actual_value')->count()
                : 0);

        $byFramework = [];
        if (Schema::hasColumn('indicators', 'results_framework_id')) {
            $byFramework = DB::table('indicators')
                ->where('tenant_id', $tid)
                ->select('results_framework_id', DB::raw('count(*) as indicator_count'))
                ->groupBy('results_framework_id')
                ->get()
                ->map(fn ($r) => [
                    'results_framework_id' => $r->results_framework_id,
                    'indicator_count' => (int) $r->indicator_count,
                ])
                ->all();
        }

        return [
            'by_framework' => $byFramework,
            'totals' => [
                'indicators' => $total,
                'with_targets' => $withTargets,
                'with_actuals' => $withActuals,
                'coverage_pct' => $total > 0 ? round(($withActuals / $total) * 100, 1) : 0,
            ],
        ];
    }
}
