<?php

namespace App\Modules\WeeklyReports\Services;

use App\Models\User;
use App\Models\WeeklyReport;
use Illuminate\Validation\ValidationException;

/**
 * Optional AI draft stub. NEVER auto-submits — human must confirm before submit.
 */
class WeeklyAiDraftService
{
    public function generateStub(WeeklyReport $report, User $actor, array $suggestions = []): array
    {
        if (! $report->isEditable()) {
            throw ValidationException::withMessages(['status' => 'Report is not editable.']);
        }

        $lines = [];
        $lines[] = 'Draft weekly summary for '.$report->reference.' (human confirmation required before submit).';
        $lines[] = '';
        $lines[] = 'Suggested narrative from confirmed sources:';

        $included = array_values(array_filter(
            $suggestions['suggestions'] ?? [],
            fn ($s) => ($s['decision'] ?? null) === 'included' || ($s['decision'] ?? null) === null
        ));

        if ($included === []) {
            $lines[] = '- No source suggestions available yet. Add achievements, WIP, or meetings manually.';
        } else {
            foreach (array_slice($included, 0, 12) as $s) {
                $section = $s['suggested_section'] ?? 'note';
                $title = $s['title'] ?? 'Item';
                $ref = $s['reference'] ?? null;
                $lines[] = sprintf('- [%s] %s%s', $section, $title, $ref ? " ({$ref})" : '');
            }
        }

        if ($report->donor_name || $report->donor_code) {
            $lines[] = '';
            $lines[] = 'Donor/project context: '.trim(($report->donor_code ? $report->donor_code.' — ' : '').($report->donor_name ?? ''));
        }

        $lines[] = '';
        $lines[] = 'This text is a stub assistant draft. Review and edit before confirming.';

        $text = implode("\n", $lines);

        $report->update([
            'ai_draft_text' => $text,
            'ai_draft_confirmed_at' => null,
            'ai_draft_confirmed_by' => null,
        ]);

        return [
            'draft' => $text,
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
}
