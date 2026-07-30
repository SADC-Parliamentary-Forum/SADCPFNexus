<?php

namespace App\Modules\Notifications\Services;

use App\Mail\ModuleNotificationMail;
use App\Models\DeviceToken;
use App\Models\Notification;
use App\Models\Notifications\NotificationChannelDelivery;
use App\Models\Notifications\NotificationDeadLetter;
use App\Models\Notifications\NotificationDeliveryAttempt;
use App\Models\Notifications\NotificationDigest;
use App\Models\Notifications\NotificationDigestItem;
use App\Models\User;
use App\Services\FcmService;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class ChannelDeliveryService
{
    public function __construct(
        private readonly SecureLinkService $links,
        private readonly OutboxService $outbox,
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
        $started = microtime(true);
        $attemptNumber = ((int) $delivery->attempt_count) + 1;

        try {
            if (! filter_var($recipient->email, FILTER_VALIDATE_EMAIL)) {
                return $this->failPermanent($delivery, $attemptNumber, 'invalid_email', 'Recipient email invalid', $started);
            }

            // No approve/reject URLs — authenticated Open-in-Nexus only.
            Mail::to($recipient->email)->queue(new ModuleNotificationMail(
                $delivery->rendered_subject ?? 'Nexus notification',
                $body,
                $recipient->name,
                null,
                null,
                $secureUrl,
            ));

            NotificationDeliveryAttempt::create([
                'channel_delivery_id' => $delivery->id,
                'attempt_number' => $attemptNumber,
                'attempted_at' => now(),
                'result' => 'accepted',
                'response_code' => 'queued',
                'response_summary' => 'Accepted by mailer driver',
                'temporary_failure' => false,
                'duration_ms' => (int) ((microtime(true) - $started) * 1000),
            ]);

            $delivery->update([
                'status' => 'sent',
                'sent_at' => now(),
                'attempt_count' => $attemptNumber,
                'provider_message_id' => 'mail-queued-'.$delivery->id.'-'.$attemptNumber,
            ]);

            $this->outbox->audit($delivery->tenant_id, 'channel_delivery', $delivery->id, 'email_sent', null, [
                'destination' => $delivery->destination_snapshot,
            ]);

            return $delivery->fresh();
        } catch (\Throwable $e) {
            return $this->failTemporary($delivery, $attemptNumber, 'provider_error', $e->getMessage(), $started);
        }
    }

    public function attemptPush(NotificationChannelDelivery $delivery, User $recipient, array $rendered, array $meta): NotificationChannelDelivery
    {
        $started = microtime(true);
        $attemptNumber = ((int) $delivery->attempt_count) + 1;

        $tokens = DeviceToken::where('user_id', $recipient->id)->pluck('token')->all();
        if ($tokens === []) {
            return $this->failPermanent($delivery, $attemptNumber, 'no_device', 'No device tokens', $started);
        }

        $fcm = app(FcmService::class);
        if (! $fcm->isConfigured()) {
            // Stub — mobile push depth is Phase 2. Mark suppressed rather than dead-letter.
            $delivery->update([
                'status' => 'suppressed',
                'suppressed' => true,
                'suppression_reason' => 'push_provider_not_configured_phase1',
                'attempt_count' => $attemptNumber,
            ]);

            return $delivery->fresh();
        }

        try {
            // Privacy-safe lock-screen title
            $title = in_array($meta['confidentiality'] ?? 'internal', ['restricted', 'confidential', 'highly_confidential', 'security_sensitive'], true)
                ? 'Nexus notification'
                : ($rendered['subject'] ?? 'Nexus notification');

            $fcm->sendToTokens($tokens, $title, 'Sign in to Nexus to view details.', array_filter([
                'trigger' => $meta['trigger'] ?? '',
                'module' => $meta['module'] ?? '',
                'url' => $this->links->normalizeRoute($meta['url'] ?? null),
            ]));

            NotificationDeliveryAttempt::create([
                'channel_delivery_id' => $delivery->id,
                'attempt_number' => $attemptNumber,
                'attempted_at' => now(),
                'result' => 'accepted',
                'response_code' => 'fcm_ok',
                'temporary_failure' => false,
                'duration_ms' => (int) ((microtime(true) - $started) * 1000),
            ]);

            $delivery->update([
                'status' => 'sent',
                'sent_at' => now(),
                'attempt_count' => $attemptNumber,
            ]);

            return $delivery->fresh();
        } catch (\Throwable $e) {
            return $this->failTemporary($delivery, $attemptNumber, 'push_error', $e->getMessage(), $started);
        }
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
            $subject = 'SADC-PF Nexus — '.ucfirst($digestType).' digest ('.$digest->period_start.')';
            $body = "Dear {$user->name},\n\nYour {$digestType} notification digest:\n\n{$lines}\n\nSign in to Nexus for details.\n\nRegards,\nSADC-PF Nexus";

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
