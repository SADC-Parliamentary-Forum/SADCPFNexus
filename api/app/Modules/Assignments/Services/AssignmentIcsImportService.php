<?php

namespace App\Modules\Assignments\Services;

use App\Models\Assignment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Str;

class AssignmentIcsImportService
{
    /**
     * Parse ICS text and create draft assignments from VEVENTs.
     *
     * @return array{created: array<int, array>, skipped: int}
     */
    public function import(string $ics, User $user): array
    {
        $events = $this->parseEvents($ics);
        $created = [];
        $skipped = 0;

        foreach ($events as $event) {
            $title = trim((string) ($event['SUMMARY'] ?? ''));
            if ($title === '') {
                $skipped++;
                continue;
            }
            $start = $this->parseDate($event['DTSTART'] ?? null);
            $end = $this->parseDate($event['DTEND'] ?? null) ?: $start;
            $uid = $event['UID'] ?? null;

            $assignment = Assignment::create([
                'tenant_id' => $user->tenant_id,
                'title' => Str::limit($title, 240),
                'description' => $event['DESCRIPTION'] ?? ('Imported from ICS' . ($uid ? " (UID: {$uid})" : '')),
                'status' => 'draft',
                'priority' => 'medium',
                'created_by' => $user->id,
                'assigned_to' => $user->id,
                'department_id' => $user->department_id,
                'start_date' => $start ?: now()->toDateString(),
                'due_date' => $end ?: ($start ?: now()->addDay()->toDateString()),
                'source_type' => 'manual',
                'source_reference' => $uid,
                'is_template' => false,
            ]);

            $created[] = [
                'id' => $assignment->id,
                'reference_number' => $assignment->reference_number,
                'title' => $assignment->title,
                'due_date' => optional($assignment->due_date)->toDateString(),
            ];
        }

        return ['created' => $created, 'skipped' => $skipped];
    }

    private function parseEvents(string $ics): array
    {
        $ics = str_replace(["\r\n", "\r"], "\n", $ics);
        // Unfold folded lines
        $ics = preg_replace("/\n[ \t]/", '', $ics) ?? $ics;
        $blocks = [];
        if (! preg_match_all('/BEGIN:VEVENT(.*?)END:VEVENT/s', $ics, $matches)) {
            return [];
        }
        foreach ($matches[1] as $block) {
            $props = [];
            foreach (explode("\n", trim($block)) as $line) {
                if ($line === '' || ! str_contains($line, ':')) {
                    continue;
                }
                [$rawKey, $value] = explode(':', $line, 2);
                $key = strtoupper(explode(';', $rawKey)[0]);
                $props[$key] = $value;
            }
            $blocks[] = $props;
        }

        return $blocks;
    }

    private function parseDate(?string $raw): ?string
    {
        if (! $raw) {
            return null;
        }
        $raw = trim($raw);
        try {
            if (preg_match('/^\d{8}T\d{6}Z?$/', $raw)) {
                return Carbon::createFromFormat(str_ends_with($raw, 'Z') ? 'Ymd\THis\Z' : 'Ymd\THis', $raw)->toDateString();
            }
            if (preg_match('/^\d{8}$/', $raw)) {
                return Carbon::createFromFormat('Ymd', $raw)->toDateString();
            }

            return Carbon::parse($raw)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }
}
