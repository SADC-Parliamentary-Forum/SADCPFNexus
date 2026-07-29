<?php

namespace App\Modules\Assignments\Services;

use App\Models\Assignment;
use App\Models\User;
use Illuminate\Support\Collection;

class AssignmentIcsExportService
{
    public function buildCalendarQuery(User $user, string $scope, string $from, string $to)
    {
        $query = Assignment::query()
            ->with(['assignee:id,name'])
            ->where('tenant_id', $user->tenant_id)
            ->where('is_template', false)
            ->whereNotNull('due_date')
            ->whereDate('due_date', '>=', $from)
            ->whereDate('due_date', '<=', $to)
            ->orderBy('due_date');

        if ($scope === 'mine') {
            $query->where('assigned_to', $user->id);
        } elseif ($scope === 'team' && $user->department_id) {
            $query->where('department_id', $user->department_id);
        }

        return $query;
    }

    public function toIcs(Collection $assignments, string $calendarName = 'SADC PF Assignments'): string
    {
        $lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//SADC PF Nexus//Assignments//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:'.$this->escape($calendarName),
        ];

        foreach ($assignments as $assignment) {
            $due = $assignment->due_date?->format('Ymd');
            if (! $due) {
                continue;
            }
            $start = $assignment->start_date?->format('Ymd') ?: $due;
            $uid = 'assignment-'.$assignment->id.'@sadcpf-nexus';
            $summary = $this->escape($assignment->title ?: 'Assignment');
            $desc = $this->escape(trim(($assignment->reference_number ?? '').' — status: '.($assignment->status ?? 'n/a')));
            $stamp = now()->format('Ymd\THis\Z');

            $lines[] = 'BEGIN:VEVENT';
            $lines[] = 'UID:'.$uid;
            $lines[] = 'DTSTAMP:'.$stamp;
            $lines[] = 'DTSTART;VALUE=DATE:'.$start;
            $lines[] = 'DTEND;VALUE=DATE:'.$due;
            $lines[] = 'SUMMARY:'.$summary;
            $lines[] = 'DESCRIPTION:'.$desc;
            if ($assignment->assignee?->name) {
                $lines[] = 'ATTENDEE;CN='.$this->escape($assignment->assignee->name).':MAILTO:noreply@sadcpf.int';
            }
            $lines[] = 'END:VEVENT';
        }

        $lines[] = 'END:VCALENDAR';

        return implode("\r\n", $lines)."\r\n";
    }

    public function feedMeta(User $user, bool $googleCredentialsPresent): array
    {
        $base = rtrim((string) config('app.url'), '/').'/api/v1/assignments';

        return [
            'provider' => $googleCredentialsPresent ? 'google' : 'ics',
            'google_credentials_present' => $googleCredentialsPresent,
            'download_url' => $base.'/calendar.ics?scope=mine',
            'subscribe_url' => $base.'/calendar.ics?scope=mine',
            'instructions' => $googleCredentialsPresent
                ? 'Google Calendar two-way sync is configured. Run assignments:sync-google-calendar or use the webhook. ICS subscribe URL remains available.'
                : 'Google credentials absent (not configured) — use the ICS subscribe/download URL in Google Calendar (Add by URL) or Outlook.',
            'sync_status' => $googleCredentialsPresent ? 'configured' : 'not_configured',
        ];
    }

    private function escape(string $value): string
    {
        return str_replace(
            ["\\", ";", ",", "\n", "\r"],
            ["\\\\", "\\;", "\\,", "\\n", ''],
            $value
        );
    }
}
