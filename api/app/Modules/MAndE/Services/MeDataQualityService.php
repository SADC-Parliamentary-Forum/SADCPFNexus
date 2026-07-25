<?php

namespace App\Modules\MAndE\Services;

use App\Models\MeActivityReport;
use App\Models\MeFollowUpAction;
use App\Models\Programme;
use App\Models\User;

/**
 * Data-quality scan (PRD §27) — read-only issue list for M&E operators.
 */
class MeDataQualityService
{
    /**
     * @return array{summary: array<string,int>, issues: list<array<string,mixed>>}
     */
    public function scan(User $user): array
    {
        $tid = (int) $user->tenant_id;
        $issues = collect();

        // Approved PIFs without M&E records.
        Programme::query()
            ->where('tenant_id', $tid)
            ->whereIn('status', ['approved', 'amended'])
            ->whereDoesntHave('meActivityReport')
            ->orderByDesc('approved_at')
            ->limit(100)
            ->get(['id', 'reference_number', 'title', 'end_date', 'approved_at'])
            ->each(function (Programme $p) use ($issues) {
                $issues->push([
                    'code'     => 'pif_without_me_record',
                    'severity' => 'error',
                    'entity'   => 'programme',
                    'entity_id'=> $p->id,
                    'reference'=> $p->reference_number,
                    'title'    => $p->title,
                    'message'  => 'Approved PIF has no M&E activity report.',
                ]);
            });

        // Past end date, still not submitted.
        MeActivityReport::query()
            ->where('tenant_id', $tid)
            ->whereIn('review_status', [MeActivityReport::STATUS_NOT_SUBMITTED, MeActivityReport::STATUS_RETURNED])
            ->whereNotNull('end_date')
            ->whereDate('end_date', '<', now()->toDateString())
            ->orderBy('end_date')
            ->limit(100)
            ->get(['id', 'reference_number', 'activity_title', 'end_date', 'report_due_at', 'review_status'])
            ->each(function (MeActivityReport $r) use ($issues) {
                $issues->push([
                    'code'     => 'past_end_without_submission',
                    'severity' => $r->report_due_at && $r->report_due_at->isPast() ? 'error' : 'warning',
                    'entity'   => 'activity_report',
                    'entity_id'=> $r->id,
                    'reference'=> $r->reference_number,
                    'title'    => $r->activity_title,
                    'message'  => 'Activity end date has passed and the report is not submitted.',
                    'url'      => '/mande/activity-reports/' . $r->id,
                ]);
            });

        // Submitted/accepted without evidence.
        MeActivityReport::query()
            ->where('tenant_id', $tid)
            ->whereIn('review_status', [
                MeActivityReport::STATUS_SUBMITTED,
                MeActivityReport::STATUS_REVIEWED,
                MeActivityReport::STATUS_ACCEPTED,
                MeActivityReport::STATUS_CLOSED,
            ])
            ->whereDoesntHave('evidence')
            ->orderByDesc('submitted_at')
            ->limit(100)
            ->get(['id', 'reference_number', 'activity_title', 'review_status'])
            ->each(function (MeActivityReport $r) use ($issues) {
                $issues->push([
                    'code'     => 'report_without_evidence',
                    'severity' => 'warning',
                    'entity'   => 'activity_report',
                    'entity_id'=> $r->id,
                    'reference'=> $r->reference_number,
                    'title'    => $r->activity_title,
                    'message'  => 'Report has no evidence items attached.',
                    'url'      => '/mande/activity-reports/' . $r->id,
                ]);
            });

        // Closed reports with open follow-ups.
        $openFollowUps = MeFollowUpAction::query()
            ->where('tenant_id', $tid)
            ->whereIn('status', ['open', 'in_progress'])
            ->whereHas('report', fn ($q) => $q->where('review_status', MeActivityReport::STATUS_CLOSED))
            ->with(['report:id,reference_number,activity_title'])
            ->limit(100)
            ->get();

        foreach ($openFollowUps as $fu) {
            $issues->push([
                'code'     => 'closed_with_open_follow_up',
                'severity' => 'warning',
                'entity'   => 'follow_up',
                'entity_id'=> $fu->id,
                'reference'=> $fu->report?->reference_number,
                'title'    => $fu->action,
                'message'  => 'Closed report still has an open follow-up action.',
                'url'      => $fu->report ? '/mande/activity-reports/' . $fu->report->id : null,
            ]);
        }

        // Invalid date ranges.
        MeActivityReport::query()
            ->where('tenant_id', $tid)
            ->whereNotNull('start_date')
            ->whereNotNull('end_date')
            ->whereColumn('end_date', '<', 'start_date')
            ->limit(50)
            ->get(['id', 'reference_number', 'activity_title'])
            ->each(function (MeActivityReport $r) use ($issues) {
                $issues->push([
                    'code'     => 'invalid_date_range',
                    'severity' => 'error',
                    'entity'   => 'activity_report',
                    'entity_id'=> $r->id,
                    'reference'=> $r->reference_number,
                    'title'    => $r->activity_title,
                    'message'  => 'End date is before start date.',
                    'url'      => '/mande/activity-reports/' . $r->id,
                ]);
            });

        $summary = [
            'total'   => $issues->count(),
            'error'   => $issues->where('severity', 'error')->count(),
            'warning' => $issues->where('severity', 'warning')->count(),
            'by_code' => $issues->groupBy('code')->map->count()->all(),
        ];

        return [
            'summary' => $summary,
            'issues'  => $issues->values()->all(),
        ];
    }
}
