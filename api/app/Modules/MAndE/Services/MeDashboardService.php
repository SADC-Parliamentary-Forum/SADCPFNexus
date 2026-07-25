<?php

namespace App\Modules\MAndE\Services;

use App\Models\MeActivityReport;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class MeDashboardService
{
    /**
     * @param array{strategic_goal_id?:int, thematic_area_id?:int, programme_id?:int, date_from?:string, date_to?:string} $filters
     */
    public function summary(User $user, array $filters = []): array
    {
        $tid = $user->tenant_id;

        $applyFilters = function ($query, string $alias = 'me_activity_reports') use ($filters) {
            if (!empty($filters['strategic_goal_id'])) {
                $query->where("{$alias}.strategic_goal_id", $filters['strategic_goal_id']);
            }
            if (!empty($filters['thematic_area_id'])) {
                $query->where("{$alias}.thematic_area_id", $filters['thematic_area_id']);
            }
            if (!empty($filters['programme_id'])) {
                $query->where("{$alias}.programme_id", $filters['programme_id']);
            }
            if (!empty($filters['date_from'])) {
                $query->whereDate("{$alias}.start_date", '>=', $filters['date_from']);
            }
            if (!empty($filters['date_to'])) {
                $query->whereDate("{$alias}.end_date", '<=', $filters['date_to']);
            }
            return $query;
        };

        // Qualify tenant_id / deleted_at — review_queue joins programmes which shares those columns (PG SQLSTATE 42702).
        $reportBase = fn () => $applyFilters(
            DB::table('me_activity_reports')
                ->where('me_activity_reports.tenant_id', $tid)
                ->whereNull('me_activity_reports.deleted_at')
        );

        // ── KPIs ──────────────────────────────────────────────────────────────
        $totalReports = (clone $reportBase())->count();
        $submitted    = (clone $reportBase())->where('review_status', 'submitted')->count();
        $reviewed     = (clone $reportBase())->where('review_status', 'reviewed')->count();
        $accepted     = (clone $reportBase())->where('review_status', 'accepted')->count();
        $closed       = (clone $reportBase())->where('review_status', 'closed')->count();
        $returned     = (clone $reportBase())->where('review_status', 'returned')->count();
        $notSubmitted = (clone $reportBase())->where('review_status', 'not_submitted')->count();

        // Approved PIFs awaiting an activity report.
        $approvedProgrammes = DB::table('programmes')
            ->where('tenant_id', $tid)
            ->whereNull('deleted_at')
            ->where('status', 'approved')
            ->count();
        $programmesWithReports = (clone $reportBase())->distinct('programme_id')->count('programme_id');
        $awaitingReport = max(0, $approvedProgrammes - $programmesWithReports);

        // Evidence pending / missing.
        $evidencePending = DB::table('me_evidence')
            ->where('tenant_id', $tid)
            ->whereNull('deleted_at')
            ->where('review_status', 'pending')
            ->count();

        // Activity reports requiring evidence but with none uploaded.
        $reportsMissingEvidence = (clone $reportBase())
            ->whereNotIn('review_status', ['not_submitted'])
            ->whereNotExists(function ($q) {
                $q->select(DB::raw(1))
                  ->from('me_evidence')
                  ->whereColumn('me_evidence.me_activity_report_id', 'me_activity_reports.id')
                  ->whereNull('me_evidence.deleted_at');
            })
            ->count();

        // Overdue reports: activity ended >30 days ago but not yet submitted.
        $overdueReports = (clone $reportBase())
            ->whereIn('review_status', ['not_submitted', 'returned'])
            ->whereNotNull('end_date')
            ->whereDate('end_date', '<', now()->subDays(30)->toDateString())
            ->count();

        // Indicators updated (have an actual value via a linked activity report).
        $indicatorsUpdated = DB::table('me_activity_report_indicator')
            ->join('me_activity_reports', 'me_activity_reports.id', '=', 'me_activity_report_indicator.me_activity_report_id')
            ->where('me_activity_reports.tenant_id', $tid)
            ->whereNull('me_activity_reports.deleted_at')
            ->whereNotNull('me_activity_report_indicator.actual_value')
            ->distinct('me_activity_report_indicator.indicator_id')
            ->count('me_activity_report_indicator.indicator_id');

        // ── By strategic goal ───────────────────────────────────────────────────
        $byGoal = $applyFilters(
            DB::table('me_activity_reports')
                ->leftJoin('strategic_goals', 'strategic_goals.id', '=', 'me_activity_reports.strategic_goal_id')
                ->where('me_activity_reports.tenant_id', $tid)
                ->whereNull('me_activity_reports.deleted_at')
        )
            ->select([
                'me_activity_reports.strategic_goal_id',
                DB::raw("COALESCE(strategic_goals.title, 'Unassigned') as goal_title"),
                DB::raw('COUNT(*) as total'),
            ])
            ->groupBy('me_activity_reports.strategic_goal_id', 'strategic_goals.title')
            ->get()
            ->map(fn ($r) => (array) $r)
            ->toArray();

        // ── By thematic area ────────────────────────────────────────────────────
        $byThematicArea = $applyFilters(
            DB::table('me_activity_reports')
                ->leftJoin('me_thematic_areas', 'me_thematic_areas.id', '=', 'me_activity_reports.thematic_area_id')
                ->where('me_activity_reports.tenant_id', $tid)
                ->whereNull('me_activity_reports.deleted_at')
        )
            ->select([
                'me_activity_reports.thematic_area_id',
                DB::raw("COALESCE(me_thematic_areas.name, 'Unassigned') as area_name"),
                DB::raw('COUNT(*) as total'),
            ])
            ->groupBy('me_activity_reports.thematic_area_id', 'me_thematic_areas.name')
            ->get()
            ->map(fn ($r) => (array) $r)
            ->toArray();

        // ── Review queue (reports awaiting M&E action) ──────────────────────────
        $reviewQueue = (clone $reportBase())
            ->leftJoin('programmes', 'programmes.id', '=', 'me_activity_reports.programme_id')
            ->whereIn('me_activity_reports.review_status', ['submitted', 'reviewed'])
            ->select([
                'me_activity_reports.id',
                'me_activity_reports.reference_number',
                'me_activity_reports.activity_title',
                'me_activity_reports.review_status',
                'me_activity_reports.submitted_at',
                'programmes.reference_number as pif_number',
            ])
            ->orderBy('me_activity_reports.submitted_at')
            ->limit(15)
            ->get()
            ->map(fn ($r) => (array) $r)
            ->toArray();

        return [
            'kpis' => [
                'approved_pifs'            => $approvedProgrammes,
                'awaiting_report'          => $awaitingReport,
                'total_reports'            => $totalReports,
                'submitted'                => $submitted,
                'reviewed'                 => $reviewed,
                'accepted'                 => $accepted,
                'closed'                   => $closed,
                'returned'                 => $returned,
                'not_submitted'            => $notSubmitted,
                'pending_review'           => $submitted + $reviewed,
                'evidence_pending'         => $evidencePending,
                'reports_missing_evidence' => $reportsMissingEvidence,
                'overdue_reports'          => $overdueReports,
                'indicators_updated'       => $indicatorsUpdated,
            ],
            'by_strategic_goal' => $byGoal,
            'by_thematic_area'  => $byThematicArea,
            'review_queue'      => $reviewQueue,
        ];
    }
}
