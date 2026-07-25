<?php

namespace App\Modules\MAndE\Services;

use App\Models\MeActivityReport;
use App\Models\MeFollowUpAction;
use App\Models\Programme;
use App\Models\User;

/**
 * Data-quality scan (PRD §27) — read-only issue list + weighted score for M&E operators.
 */
class MeDataQualityService
{
    /** @var array<string, int> Deduction weight per issue code (error severity doubles). */
    private const WEIGHTS = [
        'pif_without_me_record'       => 12,
        'past_end_without_submission' => 10,
        'invalid_date_range'          => 8,
        'report_without_evidence'     => 4,
        'closed_with_open_follow_up'  => 3,
    ];

    private const REMEDIATION = [
        'pif_without_me_record'       => 'Open Intake Queue and create or confirm the M&E record for this PIF.',
        'past_end_without_submission' => 'Complete and submit the activity report, or mark not reportable with reason.',
        'invalid_date_range'          => 'Edit the report and correct start/end dates.',
        'report_without_evidence'     => 'Attach at least one evidence item before acceptance/closure.',
        'closed_with_open_follow_up'  => 'Complete or cancel open follow-up actions on the closed report.',
    ];

    /**
     * @return array{
     *   summary: array<string,mixed>,
     *   issues: list<array<string,mixed>>,
     *   score: int,
     *   grade: string,
     *   score_breakdown: list<array<string,mixed>>
     * }
     */
    public function scan(User $user): array
    {
        $tid = (int) $user->tenant_id;
        $issues = collect();

        Programme::query()
            ->where('tenant_id', $tid)
            ->whereIn('status', ['approved', 'amended'])
            ->whereDoesntHave('meActivityReport')
            ->orderByDesc('approved_at')
            ->limit(100)
            ->get(['id', 'reference_number', 'title', 'end_date', 'approved_at'])
            ->each(function (Programme $p) use ($issues) {
                $issues->push($this->issue(
                    'pif_without_me_record',
                    'error',
                    'programme',
                    $p->id,
                    $p->reference_number,
                    $p->title,
                    'Approved PIF has no M&E activity report.',
                    '/mande/intake'
                ));
            });

        MeActivityReport::query()
            ->where('tenant_id', $tid)
            ->whereIn('review_status', [MeActivityReport::STATUS_NOT_SUBMITTED, MeActivityReport::STATUS_RETURNED])
            ->whereNotNull('end_date')
            ->whereDate('end_date', '<', now()->toDateString())
            ->orderBy('end_date')
            ->limit(100)
            ->get(['id', 'reference_number', 'activity_title', 'end_date', 'report_due_at', 'review_status'])
            ->each(function (MeActivityReport $r) use ($issues) {
                $issues->push($this->issue(
                    'past_end_without_submission',
                    $r->report_due_at && $r->report_due_at->isPast() ? 'error' : 'warning',
                    'activity_report',
                    $r->id,
                    $r->reference_number,
                    $r->activity_title,
                    'Activity end date has passed and the report is not submitted.',
                    '/mande/activity-reports/' . $r->id
                ));
            });

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
                $issues->push($this->issue(
                    'report_without_evidence',
                    'warning',
                    'activity_report',
                    $r->id,
                    $r->reference_number,
                    $r->activity_title,
                    'Report has no evidence items attached.',
                    '/mande/activity-reports/' . $r->id
                ));
            });

        $openFollowUps = MeFollowUpAction::query()
            ->where('tenant_id', $tid)
            ->whereIn('status', ['open', 'in_progress'])
            ->whereHas('report', fn ($q) => $q->where('review_status', MeActivityReport::STATUS_CLOSED))
            ->with(['report:id,reference_number,activity_title'])
            ->limit(100)
            ->get();

        foreach ($openFollowUps as $fu) {
            $issues->push($this->issue(
                'closed_with_open_follow_up',
                'warning',
                'follow_up',
                $fu->id,
                $fu->report?->reference_number,
                $fu->action,
                'Closed report still has an open follow-up action.',
                $fu->report ? '/mande/activity-reports/' . $fu->report->id : null
            ));
        }

        MeActivityReport::query()
            ->where('tenant_id', $tid)
            ->whereNotNull('start_date')
            ->whereNotNull('end_date')
            ->whereColumn('end_date', '<', 'start_date')
            ->limit(50)
            ->get(['id', 'reference_number', 'activity_title'])
            ->each(function (MeActivityReport $r) use ($issues) {
                $issues->push($this->issue(
                    'invalid_date_range',
                    'error',
                    'activity_report',
                    $r->id,
                    $r->reference_number,
                    $r->activity_title,
                    'End date is before start date.',
                    '/mande/activity-reports/' . $r->id
                ));
            });

        $summary = [
            'total'   => $issues->count(),
            'error'   => $issues->where('severity', 'error')->count(),
            'warning' => $issues->where('severity', 'warning')->count(),
            'by_code' => $issues->groupBy('code')->map->count()->all(),
        ];

        [$score, $grade, $breakdown] = $this->score($issues);

        return [
            'summary'         => $summary,
            'issues'          => $issues->values()->all(),
            'score'           => $score,
            'grade'           => $grade,
            'score_breakdown' => $breakdown,
        ];
    }

    /**
     * @param  \Illuminate\Support\Collection<int, array<string,mixed>>  $issues
     * @return array{0: int, 1: string, 2: list<array<string,mixed>>}
     */
    private function score($issues): array
    {
        $deduction = 0;
        $breakdown = [];

        foreach ($issues->groupBy('code') as $code => $group) {
            $base = self::WEIGHTS[$code] ?? 5;
            $count = $group->count();
            $errorMultiplier = $group->contains(fn ($i) => ($i['severity'] ?? '') === 'error') ? 1.5 : 1.0;
            // Diminishing: first issue full weight, each extra 50% of base.
            $impact = (int) round(($base + max(0, $count - 1) * $base * 0.5) * $errorMultiplier);
            $deduction += $impact;
            $breakdown[] = [
                'code'   => $code,
                'count'  => $count,
                'impact' => $impact,
            ];
        }

        $score = max(0, min(100, 100 - $deduction));
        $grade = match (true) {
            $score >= 90 => 'Excellent',
            $score >= 75 => 'Good',
            $score >= 50 => 'Needs attention',
            default      => 'Critical',
        };

        usort($breakdown, fn ($a, $b) => $b['impact'] <=> $a['impact']);

        return [$score, $grade, $breakdown];
    }

    /**
     * @return array<string, mixed>
     */
    private function issue(
        string $code,
        string $severity,
        string $entity,
        int $entityId,
        ?string $reference,
        ?string $title,
        string $message,
        ?string $url
    ): array {
        return [
            'code'         => $code,
            'severity'     => $severity,
            'entity'       => $entity,
            'entity_id'    => $entityId,
            'reference'    => $reference,
            'title'        => $title,
            'message'      => $message,
            'url'          => $url,
            'remediation'  => self::REMEDIATION[$code] ?? 'Review and resolve this data-quality issue.',
        ];
    }
}
