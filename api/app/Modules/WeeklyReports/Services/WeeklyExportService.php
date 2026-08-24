<?php

namespace App\Modules\WeeklyReports\Services;

use App\Models\User;
use App\Models\WeeklyReport;
use App\Modules\Assignments\Services\AssignmentService;
use App\Support\NativeDocx;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class WeeklyExportService
{
    public function __construct(private readonly WeeklyReportService $reports) {}

    public function pdf(WeeklyReport $report, User $viewer)
    {
        $report = $this->reports->show($report, $viewer);
        $payload = $this->safePayload($report, $viewer);

        return Pdf::loadView('pdf.weekly_report', [
            'report' => $report,
            'payload' => $payload,
        ])->setPaper('a4');
    }

    public function excelCsv(WeeklyReport $report, User $viewer): StreamedResponse
    {
        $report = $this->reports->show($report, $viewer);
        $payload = $this->safePayload($report, $viewer);

        $filename = $report->reference.'.csv';

        return response()->streamDownload(function () use ($payload) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['section', 'title', 'narrative', 'source', 'confidentiality']);
            foreach ($payload['rows'] as $row) {
                fputcsv($out, [$row['section'], $row['title'], $row['narrative'], $row['source'], $row['confidentiality']]);
            }
            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }


    public function wordDocx(WeeklyReport $report, User $viewer): Response
    {
        $report = $this->reports->show($report, $viewer);
        $payload = $this->safePayload($report, $viewer);

        $paras = [];
        $paras[] = $report->reference.' — Weekly Summary';
        foreach ($payload['rows'] as $row) {
            $paras[] = ($row['section'] ?? '').': '.($row['title'] ?? '');
            if (! empty($row['narrative'])) {
                $paras[] = (string) $row['narrative'];
            }
        }

        return NativeDocx::download($paras, $report->reference.'.docx');
    }

    public function managementPackDocx(WeeklyReport $report, User $viewer): Response
    {
        $report = $this->reports->show($report, $viewer);
        $payload = $this->safePayload($report, $viewer);
        $report->loadMissing('period');

        $start = optional($report->period)->start_date?->toDateString();
        $end = optional($report->period)->end_date?->toDateString();
        $feed = app(AssignmentService::class)->weeklySummaryFeed($viewer, $start, $end);
        $riskCount = count(array_filter($payload['rows'], fn ($row) => ($row['section'] ?? '') === 'risk'));
        $blockerCount = count(array_filter($payload['rows'], fn ($row) => ($row['section'] ?? '') === 'blocker'));

        $paras = [];
        $paras[] = 'SADC PF Nexus — Weekly management pack';
        $paras[] = $report->reference.' · '.$report->report_type.' · '.$report->status;
        $paras[] = 'This pack is generated for human review. It is not auto-sent to email, donors, or AI.';
        $paras[] = 'Cover: achievements, blockers, decision requests, and emerging risks from the selected digest.';
        $paras[] = 'Assignment feed (not auto-completed): completed '.($feed['counts']['completed'] ?? 0)
            .', active '.($feed['counts']['active'] ?? 0)
            .', overdue '.($feed['counts']['overdue'] ?? 0)
            .', blocked '.($feed['counts']['blocked'] ?? 0)
            .', upcoming '.($feed['counts']['upcoming'] ?? 0)
            .'. Period '.$feed['period_start'].' to '.$feed['period_end'].'.';
        $paras[] = 'Emerging risks in this digest: '.$riskCount.'. Blockers: '.$blockerCount.'. Not auto-escalated.';
        foreach ($payload['rows'] as $row) {
            $paras[] = strtoupper((string) ($row['section'] ?? 'item')).' — '.($row['title'] ?? '');
            if (! empty($row['narrative'])) {
                $paras[] = (string) $row['narrative'];
            }
            if (! empty($row['source'])) {
                $paras[] = 'Source: '.(string) $row['source'];
            }
        }

        return NativeDocx::download($paras, $report->reference.'-management-pack.docx');
    }
    public function wordDoc(WeeklyReport $report, User $viewer): Response
    {
        $report = $this->reports->show($report, $viewer);
        $payload = $this->safePayload($report, $viewer);

        $html = view('pdf.weekly_report', [
            'report' => $report,
            'payload' => $payload,
        ])->render();

        return response($html, 200, [
            'Content-Type' => 'application/msword',
            'Content-Disposition' => 'attachment; filename="'.$report->reference.'.doc"',
        ]);
    }

    private function safePayload(WeeklyReport $report, User $viewer): array
    {
        $canSeeConfidential = $viewer->isSystemAdmin()
            || $viewer->can('weekly-reports.admin')
            || $report->employee_id === $viewer->id
            || $report->supervisor_id === $viewer->id;

        $rows = [];
        foreach ($report->items as $item) {
            if ($item->confidentiality === 'confidential' && ! $canSeeConfidential) {
                continue;
            }
            $rows[] = [
                'section' => $item->section_type,
                'title' => $item->title,
                'narrative' => $item->narrative,
                'source' => trim(($item->source_type ?? '').' '.($item->source_reference_snapshot ?? '')),
                'confidentiality' => $item->confidentiality,
            ];
        }
        foreach ($report->blockers as $b) {
            if ($b->confidentiality === 'confidential' && ! $canSeeConfidential) {
                continue;
            }
            $rows[] = [
                'section' => 'blocker',
                'title' => $b->problem,
                'narrative' => $b->impact,
                'source' => $b->source_type,
                'confidentiality' => $b->confidentiality,
            ];
        }
        foreach ($report->decisionRequests as $d) {
            if ($d->confidentiality === 'confidential' && ! $canSeeConfidential) {
                continue;
            }
            $rows[] = [
                'section' => 'decision',
                'title' => $d->decision_requested,
                'narrative' => $d->impact_if_delayed,
                'source' => null,
                'confidentiality' => $d->confidentiality,
            ];
        }
        foreach ($report->priorities as $p) {
            if ($p->confidentiality === 'confidential' && ! $canSeeConfidential) {
                continue;
            }
            $rows[] = [
                'section' => 'priority',
                'title' => $p->priority_text,
                'narrative' => $p->intended_result,
                'source' => $p->carried_from_priority_id ? 'carry:'.$p->carried_from_priority_id : $p->source_type,
                'confidentiality' => $p->confidentiality,
            ];
        }
        foreach ($report->risks as $r) {
            if ($r->confidentiality === 'confidential' && ! $canSeeConfidential) {
                continue;
            }
            $rows[] = [
                'section' => 'risk',
                'title' => $r->emerging_issue,
                'narrative' => $r->possible_impact,
                'source' => null,
                'confidentiality' => $r->confidentiality,
            ];
        }

        return [
            'rows' => $rows,
            'can_see_confidential' => $canSeeConfidential,
        ];
    }
}


