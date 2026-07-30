<?php

namespace App\Modules\Notifications\Services;

use App\Mail\ModuleNotificationMail;
use App\Models\Notification;
use App\Models\Notifications\NotificationChannelDelivery;
use App\Models\Notifications\NotificationDeadLetter;
use App\Models\Notifications\NotificationDeliveryAttempt;
use App\Models\Notifications\NotificationDigest;
use App\Models\Notifications\NotificationDigestItem;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class ChannelDeliveryService
{
    public function __construct(
        private readonly SecureLinkService $links,
        private readonly OutboxService $outbox,
        private readonly FailoverMailService $failoverMail,
        private readonly PushDeliveryService $push,
    ) {}

    public function deliverInApp(
        User $recipient,
        array $rendered,
        array $policy,
        array $meta,
        ?int $eventId,
        ?int $templateVersionId,
    ): Notification {
        $secureRoute = $this->links->normalizeRoute($meta['secure_route'] ?? $meta['url'] ?? null);

        return Notification::create([
            'tenant_id' => $recipient->tenant_id,
            'user_id' => $recipient->id,
            'uuid' => (string) Str::uuid(),
            'type' => 'App\\Notifications\\ModuleNotification',
            'trigger' => $meta['trigger'] ?? ($policy['event_key'] ?? 'notification'),
            'category' => $policy['category'] ?? null,
            'importance' => $policy['importance'] ?? 'normal',
            'confidentiality' => $policy['confidentiality'] ?? 'internal',
            'delivery_class' => $policy['delivery_class'] ?? 'operational',
            'action_required' => (bool) ($policy['action_required'] ?? false),
            'subject' => $rendered['subject'],
            'body' => $rendered['body'],
            'meta' => $this->links->sanitizeMeta($meta) ?: null,
            'secure_route' => $secureRoute,
            'is_read' => false,
            'event_id' => $eventId,
            'template_version_id' => $templateVersionId,
        ]);
    }

    public function createDelivery(
        int $tenantId,
        int $recipientRowId,
        string $channel,
        array $policy,
        array $rendered,
        ?string $destination,
        ?int $templateVersionId,
        ?\DateTimeInterface $scheduledAt = null,
    ): NotificationChannelDelivery {
        return NotificationChannelDelivery::create([
            'tenant_id' => $tenantId,
            'recipient_id' => $recipientRowId,
            'channel' => $channel,
            'provider' => $channel === 'email' ? 'mail' : ($channel === 'push' ? 'fcm' : $channel),
            'destination_snapshot' => $destination,
            'template_version_id' => $templateVersionId,
            'rendered_subject' => $rendered['subject'] ?? null,
            'rendered_body_hash' => isset($rendered['body']) ? hash('sha256', $rendered['body']) : null,
            'queue_priority' => $policy['queue_priority'] ?? 'normal',
            'status' => $scheduledAt && $scheduledAt > now() ? 'scheduled' : 'pending',
            'scheduled_at' => $scheduledAt,
            'queued_at' => now(),
            'attempt_count' => 0,
        ]);
    }

    public function attemptEmail(NotificationChannelDelivery $delivery, User $recipient, string $body, string $secureUrl): NotificationChannelDelivery
    {
        return $this->attemptEmailToAddress(
            $delivery,
            (string) $recipient->email,
            (string) ($recipient->name ?? 'Recipient'),
            $body,
            $secureUrl,
        );
    }

    public function attemptEmailToAddress(
        NotificationChannelDelivery $delivery,
        string $email,
        string $name,
        string $body,
        ?string $secureUrl = null,
    ): NotificationChannelDelivery {
        $attemptNumber = ((int) $delivery->attempt_count) + 1;

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->failPermanent($delivery, $attemptNumber, 'invalid_email', 'Recipient email invalid', microtime(true));
        }

        $result = $this->failoverMail->sendToAddress(
            $email,
            $name,
            $delivery->rendered_subject ?? 'Nexus notification',
            $body,
            $secureUrl,
            $delivery,
        );

        return $this->applyMailAttemptResult($delivery, $attemptNumber, $result);
    }

    /**
     * Queue a specialized Mailable (weekly summary / correspondence) through the shared delivery ledger.
     */
    public function attemptCustomMailable(
        NotificationChannelDelivery $delivery,
        string $email,
        \Illuminate\Mail\Mailable $mailable,
    ): NotificationChannelDelivery {
        $attemptNumber = ((int) $delivery->attempt_count) + 1;

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->failPermanent($delivery, $attemptNumber, 'invalid_email', 'Recipient email invalid', microtime(true));
        }

        $result = $this->failoverMail->queueMailable($email, $mailable, $delivery);

        return $this->applyMailAttemptResult($delivery, $attemptNumber, $result);
    }

    /**
     * @param  array{ok: bool, provider: string, failover: bool, temporary: bool, code: string, summary: string, message_id: ?string, duration_ms: int}  $result
     */
    private function applyMailAttemptResult(
        NotificationChannelDelivery $delivery,
        int $attemptNumber,
        array $result,
    ): NotificationChannelDelivery {
        if ($result['ok']) {
            NotificationDeliveryAttempt::create([
                'channel_delivery_id' => $delivery->id,
                'attempt_number' => $attemptNumber,
                'attempted_at' => now(),
                'result' => 'accepted',
                'response_code' => $result['code'],
                'response_summary' => Str::limit($result['summary'], 500),
                'temporary_failure' => false,
                'duration_ms' => $result['duration_ms'],
            ]);

            $delivery->update([
                'status' => 'sent',
                'sent_at' => now(),
                'attempt_count' => $attemptNumber,
                'provider' => $result['provider'],
                'failover_provider' => $result['failover'] ? $result['provider'] : null,
                'provider_message_id' => $result['message_id'],
                'latency_ms' => $result['duration_ms'],
            ]);

            $this->outbox->audit($delivery->tenant_id, 'channel_delivery', $delivery->id, 'email_sent', null, [
                'destination' => $delivery->destination_snapshot,
                'failover' => $result['failover'],
            ]);

            return $delivery->fresh();
        }

        if ($result['temporary']) {
            return $this->failTemporary($delivery, $attemptNumber, $result['code'], $result['summary'], microtime(true) - ($result['duration_ms'] / 1000));
        }

        return $this->failPermanent($delivery, $attemptNumber, $result['code'], $result['summary'], microtime(true));
    }

    public function attemptPush(NotificationChannelDelivery $delivery, User $recipient, array $rendered, array $meta): NotificationChannelDelivery
    {
        $started = microtime(true);
        $attemptNumber = ((int) $delivery->attempt_count) + 1;

        $confidentiality = $meta['confidentiality'] ?? 'internal';
        $title = $this->push->privacySafeTitle($rendered['subject'] ?? 'Nexus notification', $confidentiality);
        $body = $this->push->privacySafeBody();
        $deep = $this->links->structuredDeepLinks($meta['url'] ?? $meta['secure_route'] ?? null);

        $result = $this->push->send($recipient, $title, $body, array_filter([
            'trigger' => $meta['trigger'] ?? '',
            'module' => $meta['module'] ?? '',
            'web_path' => $deep['web_path'],
            'mobile_url' => $deep['mobile_url'],
        ]));

        if ($result['ok']) {
            NotificationDeliveryAttempt::create([
                'channel_delivery_id' => $delivery->id,
                'attempt_number' => $attemptNumber,
                'attempted_at' => now(),
                'result' => 'accepted',
                'response_code' => $result['code'],
                'response_summary' => Str::limit($result['summary'], 500),
                'temporary_failure' => false,
                'duration_ms' => (int) ((microtime(true) - $started) * 1000),
            ]);

            $delivery->update([
                'status' => 'sent',
                'sent_at' => now(),
                'attempt_count' => $attemptNumber,
                'provider' => $result['provider'],
                'provider_message_id' => $result['message_id'],
                'latency_ms' => (int) ((microtime(true) - $started) * 1000),
            ]);

            return $delivery->fresh();
        }

        // No device is a soft suppress — must not roll back in-app/email delivery.
        if ($result['code'] === 'no_device') {
            $delivery->update([
                'status' => 'suppressed',
                'suppressed' => true,
                'suppression_reason' => 'no_device',
                'attempt_count' => $attemptNumber,
                'provider' => $result['provider'],
            ]);

            return $delivery->fresh();
        }

        if ($result['temporary']) {
            return $this->failTemporary($delivery, $attemptNumber, $result['code'], $result['summary'], $started);
        }

        return $this->failPermanent($delivery, $attemptNumber, $result['code'], $result['summary'], $started);
    }

    public function attemptSms(NotificationChannelDelivery $delivery, string $destination, string $body): NotificationChannelDelivery
    {
        $attemptNumber = ((int) $delivery->attempt_count) + 1;
        $result = app(NullSmsProvider::class)->send($destination, $body);
        $delivery->update([
            'status' => 'suppressed',
            'suppressed' => true,
            'suppression_reason' => $result['code'],
            'attempt_count' => $attemptNumber,
            'provider' => 'null_sms',
        ]);

        return $delivery->fresh();
    }

    public function attemptWhatsApp(NotificationChannelDelivery $delivery, string $destination, string $body): NotificationChannelDelivery
    {
        $attemptNumber = ((int) $delivery->attempt_count) + 1;
        $result = app(NullWhatsAppProvider::class)->send($destination, $body);
        $delivery->update([
            'status' => 'suppressed',
            'suppressed' => true,
            'suppression_reason' => $result['code'],
            'attempt_count' => $attemptNumber,
            'provider' => 'null_whatsapp',
        ]);

        return $delivery->fresh();
    }

    public function processScheduled(int $limit = 50): int
    {
        $due = NotificationChannelDelivery::query()
            ->where('status', 'scheduled')
            ->where('scheduled_at', '<=', now())
            ->where('suppressed', false)
            ->limit($limit)
            ->get();

        $count = 0;
        foreach ($due as $delivery) {
            $recipientRow = \App\Models\Notifications\NotificationRecipient::find($delivery->recipient_id);
            $user = $recipientRow ? User::find($recipientRow->user_id) : null;
            if (! $user) {
                continue;
            }
            $secureUrl = $this->links->absoluteSecureUrl('/notifications');
            $delivery->update(['status' => 'pending']);
            $this->retry($delivery, $user, 'Scheduled delivery — sign in to Nexus for details.', $secureUrl);
            $count++;
        }

        return $count;
    }

    public function retry(NotificationChannelDelivery $delivery, User $recipient, string $body, string $secureUrl): NotificationChannelDelivery
    {
        if ($delivery->suppressed) {
            return $delivery;
        }

        return match ($delivery->channel) {
            'email' => $this->attemptEmail($delivery, $recipient, $body, $secureUrl),
            'push' => $this->attemptPush($delivery, $recipient, [
                'subject' => $delivery->rendered_subject,
                'body' => $body,
            ], ['confidentiality' => 'internal']),
            'sms' => $this->attemptSms($delivery, (string) $delivery->destination_snapshot, $body),
            'whatsapp' => $this->attemptWhatsApp($delivery, (string) $delivery->destination_snapshot, $body),
            default => $delivery,
        };
    }

    public function suppress(NotificationChannelDelivery $delivery, string $reason, ?int $actorId = null): NotificationChannelDelivery
    {
        $delivery->update([
            'status' => 'suppressed',
            'suppressed' => true,
            'suppression_reason' => $reason,
        ]);

        $this->outbox->audit($delivery->tenant_id, 'channel_delivery', $delivery->id, 'suppressed', $actorId, [
            'reason' => $reason,
        ]);

        return $delivery->fresh();
    }

    public function enqueueDigestItem(User $user, NotificationChannelDelivery $delivery, string $summary, string $digestType = 'daily'): void
    {
        $periodStart = $digestType === 'weekly'
            ? now()->startOfWeek()->toDateString()
            : now()->toDateString();
        $periodEnd = $digestType === 'weekly'
            ? now()->endOfWeek()->toDateString()
            : now()->toDateString();

        $digest = NotificationDigest::query()->firstOrCreate(
            [
                'user_id' => $user->id,
                'digest_type' => $digestType,
                'period_start' => $periodStart,
            ],
            [
                'tenant_id' => $user->tenant_id,
                'period_end' => $periodEnd,
                'status' => 'pending',
            ]
        );

        NotificationDigestItem::query()->firstOrCreate(
            [
                'digest_id' => $digest->id,
                'channel_delivery_id' => $delivery->id,
            ],
            ['summary' => $summary]
        );

        $delivery->update(['status' => 'digest_pending']);
    }

    public function sendPendingDigests(string $digestType = 'daily'): int
    {
        $sent = 0;
        $digests = NotificationDigest::query()
            ->where('digest_type', $digestType)
            ->where('status', 'pending')
            ->get();

        foreach ($digests as $digest) {
            $user = User::find($digest->user_id);
            if (! $user) {
                continue;
            }

            $items = NotificationDigestItem::query()->where('digest_id', $digest->id)->get();
            if ($items->isEmpty()) {
                $digest->update(['status' => 'empty']);
                continue;
            }

            $lines = $items->map(fn ($i) => '- '.($i->summary ?: 'Notification #'.$i->channel_delivery_id))->implode("\n");
            $aiSummary = null;
            if (config('notifications.ai_enabled', true)) {
                try {
                    $suggestion = app(NotificationIntelligenceService::class)->summariseDigest($digest);
                    $aiSummary = $suggestion->suggestion['summary'] ?? null;
                } catch (\Throwable) {
                    $aiSummary = null;
                }
            }

            $subject = 'SADC-PF Nexus — '.ucfirst($digestType).' digest ('.$digest->period_start.')';
            $body = "Dear {$user->name},\n\nYour {$digestType} notification digest:\n\n{$lines}\n\n";
            if ($aiSummary) {
                $body .= "Summary (from existing items only):\n{$aiSummary}\n\n";
            }
            $body .= "Sign in to Nexus for details.\n\nRegards,\nSADC-PF Nexus";

            if (filter_var($user->email, FILTER_VALIDATE_EMAIL)) {
                Mail::to($user->email)->queue(new ModuleNotificationMail($subject, $body, $user->name));
            }

            $digest->update(['status' => 'sent', 'sent_at' => now()]);
            $sent++;
        }

        return $sent;
    }

    private function failTemporary(
        NotificationChannelDelivery $delivery,
        int $attemptNumber,
        string $code,
        string $summary,
        float $started,
    ): NotificationChannelDelivery {
        $retryProfile = ['max_attempts' => 5, 'backoff_seconds' => [60, 300, 900, 3600, 14400]];
        $max = $retryProfile['max_attempts'];
        $backoff = $retryProfile['backoff_seconds'][$attemptNumber - 1] ?? 14400;
        $temporary = $attemptNumber < $max;

        NotificationDeliveryAttempt::create([
            'channel_delivery_id' => $delivery->id,
            'attempt_number' => $attemptNumber,
            'attempted_at' => now(),
            'result' => $temporary ? 'temporary_failure' : 'permanent_failure',
            'response_code' => $code,
            'response_summary' => Str::limit($summary, 500),
            'temporary_failure' => $temporary,
            'next_retry_at' => $temporary ? now()->addSeconds($backoff) : null,
            'duration_ms' => (int) ((microtime(true) - $started) * 1000),
        ]);

        $delivery->update([
            'status' => $temporary ? 'retry_scheduled' : 'failed',
            'failed_at' => $temporary ? null : now(),
            'failure_code' => $code,
            'attempt_count' => $attemptNumber,
        ]);

        if (! $temporary) {
            NotificationDeadLetter::create([
                'tenant_id' => $delivery->tenant_id,
                'channel_delivery_id' => $delivery->id,
                'failure_code' => $code,
                'failure_summary' => Str::limit($summary, 2000),
                'status' => 'open',
            ]);
        }

        return $delivery->fresh();
    }

    private function failPermanent(
        NotificationChannelDelivery $delivery,
        int $attemptNumber,
        string $code,
        string $summary,
        float $started,
    ): NotificationChannelDelivery {
        NotificationDeliveryAttempt::create([
            'channel_delivery_id' => $delivery->id,
            'attempt_number' => $attemptNumber,
            'attempted_at' => now(),
            'result' => 'permanent_failure',
            'response_code' => $code,
            'response_summary' => Str::limit($summary, 500),
            'temporary_failure' => false,
            'duration_ms' => (int) ((microtime(true) - $started) * 1000),
        ]);

        $delivery->update([
            'status' => 'failed',
            'failed_at' => now(),
            'failure_code' => $code,
            'attempt_count' => $attemptNumber,
        ]);

        if (in_array($code, ['invalid_email', 'hard_bounce'], true)) {
            NotificationDeadLetter::create([
                'tenant_id' => $delivery->tenant_id,
                'channel_delivery_id' => $delivery->id,
                'failure_code' => $code,
                'failure_summary' => Str::limit($summary, 2000),
                'status' => 'open',
            ]);
        }

        return $delivery->fresh();
    }
}
