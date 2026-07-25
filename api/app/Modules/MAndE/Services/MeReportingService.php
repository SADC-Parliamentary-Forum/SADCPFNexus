<?php

namespace App\Modules\MAndE\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Strategic reporting aggregates (PRD §10.11). Foundational reporting only —
 * advanced indicator aggregation dashboards are out of scope (Phase 2).
 */
class MeReportingService
{
    public function strategic(User $user, array $filters = []): array
    {
        $tid = $user->tenant_id;

        // Activities per strategic goal / objective.
        $activitiesPerGoal = DB::table('me_activity_reports')
            ->leftJoin('strategic_goals', 'strategic_goals.id', '=', 'me_activity_reports.strategic_goal_id')
            ->where('me_activity_reports.tenant_id', $tid)
            ->whereNull('me_activity_reports.deleted_at')
            ->select([
                DB::raw("COALESCE(strategic_goals.title, 'Unassigned') as goal_title"),
                DB::raw('COUNT(*) as activities'),
                DB::raw("SUM(CASE WHEN me_activity_reports.review_status = 'closed' THEN 1 ELSE 0 END) as closed"),
            ])
            ->groupBy('strategic_goals.title')
            ->get()->map(fn ($r) => (array) $r)->toArray();

        // Outputs per programme (number of activity reports per PIF).
        $outputsPerProgramme = DB::table('me_activity_reports')
            ->join('programmes', 'programmes.id', '=', 'me_activity_reports.programme_id')
            ->where('me_activity_reports.tenant_id', $tid)
            ->whereNull('me_activity_reports.deleted_at')
            ->select([
                'programmes.reference_number as pif_number',
                'programmes.title as programme_title',
                DB::raw('COUNT(*) as activities'),
                DB::raw('SUM(COALESCE(me_activity_reports.actual_participants, 0)) as participants'),
            ])
            ->groupBy('programmes.reference_number', 'programmes.title')
            ->get()->map(fn ($r) => (array) $r)->toArray();

        // Indicators updated vs total.
        $totalIndicators = DB::table('indicators')
            ->where('tenant_id', $tid)->whereNull('deleted_at')->where('is_active', true)->count();
        $updatedIndicators = DB::table('me_activity_report_indicator')
            ->join('me_activity_reports', 'me_activity_reports.id', '=', 'me_activity_report_indicator.me_activity_report_id')
            ->where('me_activity_reports.tenant_id', $tid)
            ->whereNull('me_activity_reports.deleted_at')
            ->whereNotNull('me_activity_report_indicator.actual_value')
            ->distinct('me_activity_report_indicator.indicator_id')
            ->count('me_activity_report_indicator.indicator_id');

        // Evidence coverage: reports with evidence vs total submitted reports.
        $submittedReports = DB::table('me_activity_reports')
            ->where('tenant_id', $tid)->whereNull('deleted_at')
            ->whereNotIn('review_status', ['not_submitted'])->count();
        $reportsWithEvidence = DB::table('me_activity_reports')
            ->where('me_activity_reports.tenant_id', $tid)->whereNull('me_activity_reports.deleted_at')
            ->whereNotIn('review_status', ['not_submitted'])
            ->whereExists(function ($q) {
                $q->select(DB::raw(1))->from('me_evidence')
                  ->whereColumn('me_evidence.me_activity_report_id', 'me_activity_reports.id')
                  ->whereNull('me_evidence.deleted_at');
            })->count();

        // Thematic distribution.
        $thematicDistribution = DB::table('me_activity_reports')
            ->leftJoin('me_thematic_areas', 'me_thematic_areas.id', '=', 'me_activity_reports.thematic_area_id')
            ->where('me_activity_reports.tenant_id', $tid)
            ->whereNull('me_activity_reports.deleted_at')
            ->select([
                DB::raw("COALESCE(me_thematic_areas.name, 'Unassigned') as area_name"),
                DB::raw('COUNT(*) as activities'),
            ])
            ->groupBy('me_thematic_areas.name')
            ->get()->map(fn ($r) => (array) $r)->toArray();

        // Underreported areas: active programmes (approved) without any reports.
        $underreported = DB::table('programmes')
            ->where('programmes.tenant_id', $tid)
            ->whereNull('programmes.deleted_at')
            ->where('programmes.status', 'approved')
            ->whereNotExists(function ($q) {
                $q->select(DB::raw(1))->from('me_activity_reports')
                  ->whereColumn('me_activity_reports.programme_id', 'programmes.id')
                  ->whereNull('me_activity_reports.deleted_at');
            })
            ->select(['programmes.id', 'programmes.reference_number as pif_number', 'programmes.title'])
            ->limit(50)
            ->get()->map(fn ($r) => (array) $r)->toArray();

        return [
            'activities_per_goal'   => $activitiesPerGoal,
            'outputs_per_programme' => $outputsPerProgramme,
            'indicators' => [
                'total'   => $totalIndicators,
                'updated' => $updatedIndicators,
                'coverage_pct' => $totalIndicators > 0 ? round(($updatedIndicators / $totalIndicators) * 100, 1) : 0,
            ],
            'evidence_coverage' => [
                'submitted_reports'    => $submittedReports,
                'reports_with_evidence'=> $reportsWithEvidence,
                'coverage_pct' => $submittedReports > 0 ? round(($reportsWithEvidence / $submittedReports) * 100, 1) : 0,
            ],
            'thematic_distribution' => $thematicDistribution,
            'underreported_areas'   => $underreported,
        ];
    }

    /**
     * Donor / project activity matrix for a results framework (PRD §26).
     *
     * @return array{
     *   framework: array<string,mixed>|null,
     *   activities: list<array<string,mixed>>,
     *   indicators: list<array<string,mixed>>,
     *   summary: array<string,mixed>
     * }
     */
    public function donor(User $user, array $filters = []): array
    {
        $tid = $user->tenant_id;
        $frameworkId = isset($filters['results_framework_id']) ? (int) $filters['results_framework_id'] : null;

        $framework = null;
        if ($frameworkId) {
            $framework = DB::table('results_frameworks')
                ->where('tenant_id', $tid)
                ->where('id', $frameworkId)
                ->whereNull('deleted_at')
                ->first();
        }

        $indicatorIds = [];
        if ($frameworkId) {
            $indicatorIds = DB::table('indicators')
                ->where('tenant_id', $tid)
                ->where('results_framework_id', $frameworkId)
                ->whereNull('deleted_at')
                ->pluck('id')
                ->all();
        }

        $activitiesQuery = DB::table('me_activity_reports')
            ->leftJoin('programmes', 'programmes.id', '=', 'me_activity_reports.programme_id')
            ->leftJoin('me_thematic_areas', 'me_thematic_areas.id', '=', 'me_activity_reports.thematic_area_id')
            ->where('me_activity_reports.tenant_id', $tid)
            ->whereNull('me_activity_reports.deleted_at')
            ->when(!empty($filters['date_from']), fn ($q) => $q->whereDate('me_activity_reports.start_date', '>=', $filters['date_from']))
            ->when(!empty($filters['date_to']), fn ($q) => $q->whereDate('me_activity_reports.end_date', '<=', $filters['date_to']))
            ->when(!empty($filters['review_status']), fn ($q) => $q->where('me_activity_reports.review_status', $filters['review_status']))
            ->when(!empty($filters['thematic_area_id']), fn ($q) => $q->where('me_activity_reports.thematic_area_id', (int) $filters['thematic_area_id']))
            ->when(!empty($filters['strategic_goal_id']), fn ($q) => $q->where('me_activity_reports.strategic_goal_id', (int) $filters['strategic_goal_id']));

        if ($frameworkId && $indicatorIds !== []) {
            $activitiesQuery->whereExists(function ($q) use ($indicatorIds) {
                $q->select(DB::raw(1))
                    ->from('me_activity_report_indicator')
                    ->whereColumn('me_activity_report_indicator.me_activity_report_id', 'me_activity_reports.id')
                    ->whereIn('me_activity_report_indicator.indicator_id', $indicatorIds);
            });
        } elseif ($frameworkId) {
            $activitiesQuery->whereRaw('1 = 0');
        }

        $activities = $activitiesQuery
            ->select([
                'me_activity_reports.id',
                'me_activity_reports.reference_number',
                'me_activity_reports.activity_title',
                'me_activity_reports.review_status',
                'me_activity_reports.start_date',
                'me_activity_reports.end_date',
                'me_activity_reports.actual_participants',
                'me_activity_reports.thematic_area_id',
                'me_thematic_areas.name as thematic_area_name',
                'programmes.reference_number as pif_number',
                'programmes.title as programme_title',
            ])
            ->orderByDesc('me_activity_reports.start_date')
            ->limit(500)
            ->get()
            ->map(fn ($r) => (array) $r)
            ->toArray();

        $indicators = [];
        if ($frameworkId) {
            $indicators = DB::table('indicators')
                ->leftJoin('me_activity_report_indicator', 'me_activity_report_indicator.indicator_id', '=', 'indicators.id')
                ->leftJoin('me_activity_reports', function ($j) {
                    $j->on('me_activity_reports.id', '=', 'me_activity_report_indicator.me_activity_report_id')
                        ->whereNull('me_activity_reports.deleted_at');
                })
                ->where('indicators.tenant_id', $tid)
                ->where('indicators.results_framework_id', $frameworkId)
                ->whereNull('indicators.deleted_at')
                ->select([
                    'indicators.id',
                    'indicators.code',
                    'indicators.name',
                    'indicators.result_level',
                    'indicators.unit',
                    'indicators.annual_target',
                    DB::raw('COUNT(DISTINCT me_activity_reports.id) as linked_activities'),
                    DB::raw('SUM(me_activity_report_indicator.actual_value) as sum_actual'),
                ])
                ->groupBy(
                    'indicators.id',
                    'indicators.code',
                    'indicators.name',
                    'indicators.result_level',
                    'indicators.unit',
                    'indicators.annual_target'
                )
                ->get()
                ->map(fn ($r) => (array) $r)
                ->toArray();
        }

        $byStatus = [];
        foreach ($activities as $a) {
            $st = $a['review_status'] ?? 'unknown';
            $byStatus[$st] = ($byStatus[$st] ?? 0) + 1;
        }

        return [
            'framework'  => $framework ? (array) $framework : null,
            'activities' => $activities,
            'indicators' => $indicators,
            'summary'    => [
                'activity_count'   => count($activities),
                'indicator_count'  => count($indicators),
                'participants_sum' => array_sum(array_map(fn ($a) => (int) ($a['actual_participants'] ?? 0), $activities)),
                'by_status'        => $byStatus,
            ],
        ];
    }
}
