<?php

namespace App\Modules\Assignments\Services;

use App\Models\Assignment;
use App\Models\AssignmentIcsFeed;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

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
        $feed = $this->issueOrGetFeed($user);
        $base = rtrim((string) config('app.url'), '/').'/api/v1/assignments';

        return [
            'provider' => $googleCredentialsPresent ? 'google' : 'ics',
            'google_credentials_present' => $googleCredentialsPresent,
            'download_url' => $base.'/calendar.ics?scope=mine',
            'subscribe_url' => $base.'/calendar-subscribe/'.$feed->plainToken(),
            'instructions' => $googleCredentialsPresent
                ? 'Google Calendar two-way sync is configured. Run assignments:sync-google-calendar or use the webhook. The ICS subscribe URL is a secret feed token — add it in Google Calendar or Outlook (Add by URL). Do not share it. In-app Download ICS still uses your signed-in session.'
                : 'Google credentials are not configured. Paste the ICS subscribe URL into Google Calendar or Outlook (Add by URL). That URL is a secret — anyone who has it can read your assignments. In-app Download ICS still uses your signed-in session.',
            'sync_status' => $googleCredentialsPresent ? 'configured' : 'not_configured',
        ];
    }

    public function issueOrGetFeed(User $user): AssignmentIcsFeed
    {
        $feed = AssignmentIcsFeed::query()
            ->where('user_id', $user->id)
            ->whereNull('revoked_at')
            ->first();

        if ($feed && $feed->plainToken()) {
            return $feed;
        }

        if ($feed) {
            return $this->rotateFeed($user);
        }

        return $this->createFeed($user);
    }

    public function rotateFeed(User $user): AssignmentIcsFeed
    {
        return DB::transaction(function () use ($user) {
            AssignmentIcsFeed::query()
                ->where('user_id', $user->id)
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now()]);

            return $this->createFeed($user);
        });
    }

    public function icsForSubscribeToken(string $token): ?string
    {
        $plain = preg_replace('/\.ics$/i', '', $token) ?? $token;
        if ($plain === '') {
            return null;
        }

        $feed = AssignmentIcsFeed::query()
            ->with('user')
            ->where('token_hash', AssignmentIcsFeed::hashToken($plain))
            ->whereNull('revoked_at')
            ->first();

        $user = $feed?->user;
        if (! $feed || ! $user || ! $user->accountAllowsAuthentication()) {
            return null;
        }

        $from = now()->subMonth()->startOfMonth()->toDateString();
        $to = now()->addMonths(6)->endOfMonth()->toDateString();
        $assignments = $this->buildCalendarQuery($user, AssignmentIcsFeed::SCOPE_MINE, $from, $to)
            ->limit(500)
            ->get();

        $feed->markUsed();

        return $this->toIcs($assignments);
    }

    private function createFeed(User $user): AssignmentIcsFeed
    {
        $feed = new AssignmentIcsFeed([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'scope' => AssignmentIcsFeed::SCOPE_MINE,
        ]);
        $feed->setPlainToken(AssignmentIcsFeed::generatePlainToken());
        $feed->save();

        return $feed;
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
