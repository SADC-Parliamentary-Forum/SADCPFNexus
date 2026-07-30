<?php

namespace App\Modules\Notifications\Services;

use App\Models\Notifications\NotificationAckCampaign;
use App\Models\Notifications\NotificationAckRecipient;
use App\Models\Notifications\NotificationReminder;
use App\Models\User;
use App\Modules\WorkflowEngine\Services\SlaCalendarService;
use App\Services\NotificationService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class AckCampaignService
{
    public function __construct(
        private readonly RecipientResolutionService $recipients,
        private readonly SlaCalendarService $calendars,
    ) {}

    public function create(int $tenantId, int $actorId, array $data): NotificationAckCampaign
    {
        return NotificationAckCampaign::create([
            'tenant_id' => $tenantId,
            'uuid' => (string) Str::uuid(),
            'title' => $data['title'],
            'body' => $data['body'],
            'importance' => $data['importance'] ?? 'high',
            'required' => (bool) ($data['required'] ?? true),
            'deadline_at' => isset($data['deadline_at']) ? Carbon::parse($data['deadline_at']) : null,
            'reminder_offsets_hours' => $data['reminder_offsets_hours'] ?? [24, 4],
            'escalation_policy' => $data['escalation_policy'] ?? ['notify_roles' => ['HR Manager']],
            'audience' => $data['audience'] ?? ['user_ids' => []],
            'secure_route' => app(SecureLinkService::class)->normalizeRoute($data['secure_route'] ?? '/notifications'),
            'status' => 'draft',
            'created_by' => $actorId,
        ]);
    }

    public function activate(NotificationAckCampaign $campaign): NotificationAckCampaign
    {
        if ($campaign->status !== 'draft') {
            return $campaign;
        }

        $resolved = $this->recipients->resolve((int) $campaign->tenant_id, $campaign->audience ?? []);
        $dispatch = app(NotificationService::class);

        foreach ($resolved as $entry) {
            /** @var User $user */
            $user = $entry['user'];
            $notification = $dispatch->dispatch(
                $user,
                'notifications.ack_campaign',
                [
                    'name' => $user->name,
                    'title' => $campaign->title,
                    'summary' => $campaign->body,
                    'deadline' => optional($campaign->deadline_at)->toDateTimeString(),
                ],
                [
                    'module' => 'notifications',
                    'url' => $campaign->secure_route ?: '/notifications',
                    'action_required' => true,
                    'record_id' => $campaign->id,
                    'importance' => $campaign->importance,
                    'force_immediate' => true,
                ],
                true,
                true,
                'ack-campaign:'.$campaign->id.':user:'.$user->id,
            );

            NotificationAckRecipient::create([
                'tenant_id' => $campaign->tenant_id,
                'campaign_id' => $campaign->id,
                'user_id' => $user->id,
                'notification_id' => $notification->id ?? null,
                'status' => 'pending',
            ]);

            $this->scheduleReminders($campaign, $user);
        }

        $campaign->update([
            'status' => 'active',
            'activated_at' => now(),
        ]);

        return $campaign->fresh();
    }

    public function acknowledge(NotificationAckCampaign $campaign, User $user): NotificationAckRecipient
    {
        $row = NotificationAckRecipient::query()
            ->where('campaign_id', $campaign->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        if ($row->status === 'acknowledged') {
            return $row;
        }

        $row->update([
            'status' => 'acknowledged',
            'acknowledged_at' => now(),
        ]);

        if ($row->notification_id) {
            \App\Models\Notification::query()
                ->where('id', $row->notification_id)
                ->where('user_id', $user->id)
                ->update(['acknowledged_at' => now(), 'is_read' => true, 'read_at' => now()]);
        }

        NotificationReminder::query()
            ->where('source_type', 'ack_campaign')
            ->where('source_id', $campaign->id)
            ->where('user_id', $user->id)
            ->where('status', 'pending')
            ->update(['status' => 'cancelled']);

        return $row->fresh();
    }

    public function report(NotificationAckCampaign $campaign): array
    {
        $rows = NotificationAckRecipient::query()->where('campaign_id', $campaign->id)->get();

        return [
            'campaign_id' => $campaign->id,
            'title' => $campaign->title,
            'status' => $campaign->status,
            'deadline_at' => optional($campaign->deadline_at)->toIso8601String(),
            'totals' => [
                'audience' => $rows->count(),
                'acknowledged' => $rows->where('status', 'acknowledged')->count(),
                'pending' => $rows->where('status', 'pending')->count(),
                'overdue' => $rows->where('status', 'overdue')->count(),
                'escalated' => $rows->where('status', 'escalated')->count(),
            ],
            'recipients' => $rows->map(fn ($r) => [
                'user_id' => $r->user_id,
                'status' => $r->status,
                'acknowledged_at' => optional($r->acknowledged_at)->toIso8601String(),
                'reminder_count' => $r->reminder_count,
            ])->values()->all(),
        ];
    }

    public function processDueReminders(int $limit = 50): int
    {
        $due = NotificationReminder::query()
            ->where('source_type', 'ack_campaign')
            ->where('status', 'pending')
            ->where('due_at', '<=', now())
            ->limit($limit)
            ->get();

        $count = 0;
        foreach ($due as $reminder) {
            $campaign = NotificationAckCampaign::find($reminder->source_id);
            $user = User::find($reminder->user_id);
            if (! $campaign || $campaign->status !== 'active' || ! $user) {
                $reminder->update(['status' => 'cancelled']);
                continue;
            }

            $recipient = NotificationAckRecipient::query()
                ->where('campaign_id', $campaign->id)
                ->where('user_id', $user->id)
                ->first();

            if (! $recipient || $recipient->status === 'acknowledged') {
                $reminder->update(['status' => 'cancelled']);
                continue;
            }

            app(NotificationService::class)->dispatch(
                $user,
                'notifications.ack_reminder',
                [
                    'name' => $user->name,
                    'title' => $campaign->title,
                    'summary' => 'Acknowledgement still required: '.$campaign->title,
                ],
                [
                    'module' => 'notifications',
                    'url' => $campaign->secure_route ?: '/notifications',
                    'action_required' => true,
                    'record_id' => $campaign->id,
                    'force_immediate' => true,
                ],
                true,
                true,
                'ack-reminder:'.$reminder->id,
            );

            $recipient->update([
                'last_reminded_at' => now(),
                'reminder_count' => ((int) $recipient->reminder_count) + 1,
                'status' => ($campaign->deadline_at && $campaign->deadline_at->isPast()) ? 'overdue' : $recipient->status,
            ]);

            $reminder->update(['status' => 'sent', 'sent_at' => now()]);
            $count++;

            if ($campaign->deadline_at && $campaign->deadline_at->isPast() && $recipient->status !== 'escalated') {
                $this->escalate($campaign, $recipient);
            }
        }

        return $count;
    }

    private function scheduleReminders(NotificationAckCampaign $campaign, User $user): void
    {
        if (! $campaign->deadline_at) {
            return;
        }

        $calendar = $this->calendars->resolveCalendar((int) $campaign->tenant_id, null);
        $offsets = $campaign->reminder_offsets_hours ?: [24, 4];

        foreach ($offsets as $hoursBefore) {
            $hoursBefore = (int) $hoursBefore;
            $rawDue = $campaign->deadline_at->copy()->subHours($hoursBefore);
            // Calendar-aware: if due falls outside working time, snap forward using SLA helper with 1h.
            $due = $calendar
                ? $this->calendars->computeDueAt($rawDue->copy()->subHour(), 1, $calendar, $campaign->importance)
                : $rawDue;

            if ($due->isPast()) {
                continue;
            }

            NotificationReminder::create([
                'tenant_id' => $campaign->tenant_id,
                'source_type' => 'ack_campaign',
                'source_id' => $campaign->id,
                'user_id' => $user->id,
                'event_key' => 'notifications.ack_reminder',
                'due_at' => $due,
                'calendar_code' => $calendar?->code,
                'status' => 'pending',
                'payload' => ['hours_before' => $hoursBefore],
            ]);
        }
    }

    private function escalate(NotificationAckCampaign $campaign, NotificationAckRecipient $recipient): void
    {
        $roles = $campaign->escalation_policy['notify_roles'] ?? ['HR Manager'];
        $resolved = $this->recipients->resolve((int) $campaign->tenant_id, ['roles' => $roles]);

        foreach ($resolved as $entry) {
            app(NotificationService::class)->dispatch(
                $entry['user'],
                'notifications.ack_escalation',
                [
                    'name' => $entry['user']->name,
                    'title' => $campaign->title,
                    'summary' => 'Escalation: acknowledgement overdue for user #'.$recipient->user_id,
                ],
                [
                    'module' => 'notifications',
                    'url' => '/admin/notifications',
                    'action_required' => true,
                    'record_id' => $campaign->id,
                    'force_immediate' => true,
                ],
                true,
                true,
                'ack-escalation:'.$campaign->id.':'.$recipient->user_id.':'.$entry['user']->id,
            );
        }

        $recipient->update(['status' => 'escalated', 'escalated_at' => now()]);
    }
}
