<?php

namespace App\Modules\WeeklyReports\Services;

use App\Models\User;
use App\Models\WeeklyReport;
use Illuminate\Validation\ValidationException;

/**
 * Stronger structured AI draft from suggestions. NEVER auto-submits — human must confirm.
 */
class WeeklyAiDraftService
{
    public function generateStub(WeeklyReport $report, User $actor, array $suggestions = []): array
    {
        return $this->generateDraft($report, $actor, $suggestions);
    }

    public function generateDraft(WeeklyReport $report, User $actor, array $suggestions = []): array
    {
        if (! $report->isEditable()) {
            throw ValidationException::withMessages(['status' => 'Report is not editable.']);
        }

        $included = array_values(array_filter(
            $suggestions['suggestions'] ?? [],
            fn ($s) => ($s['decision'] ?? null) === 'included' || ($s['decision'] ?? null) === null
        ));

        $sections = $this->groupBySection($included);
        $lines = [];
        $lines[] = 'Draft weekly summary for '.$report->reference.' (human confirmation required before submit).';
        $lines[] = 'Prepared for '.$actor->name.'.';
        $lines[] = '';

        $order = [
            'achievement' => 'Achievements',
            'wip' => 'Work in progress',
            'priority' => 'Priorities / upcoming deadlines',
            'blocker' => 'Blockers / risks',
            'meeting' => 'Meetings',
            'decision' => 'Decisions',
            'note' => 'Notes',
        ];

        $sectionPayload = [];
        foreach ($order as $key => $heading) {
            $items = $sections[$key] ?? [];
            if ($items === []) {
                continue;
            }
            $lines[] = $heading.':';
            $sectionLines = [];
            foreach ($items as $s) {
                $title = $s['title'] ?? 'Item';
                $ref = $s['reference'] ?? null;
                $status = $s['status'] ?? null;
                $bullet = '- '.$title;
                if ($ref) {
                    $bullet .= ' ('.$ref.')';
                }
                if ($status) {
                    $bullet .= ' — '.$status;
                }
                $lines[] = $bullet;
                $sectionLines[] = [
                    'title' => $title,
                    'reference' => $ref,
                    'status' => $status,
                    'source_type' => $s['source_type'] ?? null,
                ];
            }
            $lines[] = '';
            $sectionPayload[$key] = [
                'heading' => $heading,
                'items' => $sectionLines,
            ];
        }

        if ($sectionPayload === []) {
            $lines[] = 'No source suggestions available yet. Add achievements, WIP, or meetings manually.';
            $lines[] = '';
        }

        if ($report->donor_name || $report->donor_code) {
            $lines[] = 'Donor/project context: '.trim(($report->donor_code ? $report->donor_code.' — ' : '').($report->donor_name ?? ''));
            $lines[] = '';
        }

        $lines[] = 'Narrative close: Progress this period is summarised above from confirmed operational sources. Review and edit before confirming.';
        $lines[] = '';
        $lines[] = 'This text is an assistant draft. Human confirmation required — never auto-submitted.';

        $text = implode("\n", $lines);

        $report->update([
            'ai_draft_text' => $text,
            'ai_draft_confirmed_at' => null,
            'ai_draft_confirmed_by' => null,
        ]);

        return [
            'draft' => $text,
            'sections' => $sectionPayload,
            'requires_human_confirm' => true,
            'auto_submit' => false,
            'confirmed' => false,
        ];
    }

    public function confirm(WeeklyReport $report, User $actor): WeeklyReport
    {
        if (empty($report->ai_draft_text)) {
            throw ValidationException::withMessages(['ai_draft_text' => 'Generate a draft before confirming.']);
        }

        $report->update([
            'ai_draft_confirmed_at' => now(),
            'ai_draft_confirmed_by' => $actor->id,
            'additional_notes' => trim(($report->additional_notes ? $report->additional_notes."\n\n" : '').$report->ai_draft_text),
        ]);

        return $report->fresh();
    }

    private function groupBySection(array $suggestions): array
    {
        $groups = [];
        foreach ($suggestions as $s) {
            $section = $s['suggested_section'] ?? 'note';
            $groups[$section][] = $s;
        }

        return $groups;
    }
}
