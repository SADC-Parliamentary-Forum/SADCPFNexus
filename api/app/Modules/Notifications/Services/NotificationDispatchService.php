<?php

namespace App\Modules\Notifications\Services;

use App\Models\Notification;
use App\Models\Notifications\NotificationChannelDelivery;
use App\Models\Notifications\NotificationDeadLetter;
use App\Models\Notifications\NotificationEvent;
use App\Models\Notifications\NotificationOutbox;
use App\Models\Notifications\NotificationRecipient;
use App\Models\Notifications\NotificationRecord;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Shared Notifications Phase 1 engine.
 * Business modules publish events; this service owns delivery.
 */
class NotificationDispatchService
{
    public function __construct(
        private readonly OutboxService $outbox,
        private readonly PolicyService $policies,
        private readonly TemplateService $templates,
        private readonly RecipientResolutionService $recipients,
        private readonly ChannelDeliveryService $channels,
        private readonly SecureLinkService $links,
    ) {}

    /**
     * Compatibility entry used by legacy NotificationService::dispatch.
     * Publishes via outbox then consumes (inline after commit).
     */
    public function dispatchLegacy(
        User $recipient,
        string $triggerKey,
        array $vars = [],
        array $meta = [],
        bool $sendEmail = true,
        bool $sendPush = true,
        ?string $idempotencyKey = null,
    ): Notification {
        $meta = $this->links->sanitizeMeta($meta);
        $meta['trigger'] = $triggerKey;
        $idempotencyKey ??= $this->legacyIdempotencyKey($recipient, $triggerKey, $meta);

        $outbox = $this->outbox->enqueue([
            'tenant_id' => $recipient->tenant_id,
            'event_type' => $triggerKey,
            'source_module' => $meta['module'] ?? explode('.', $triggerKey)[0] ?? 'system',
            'source_type' => $meta['source_type'] ?? null,
            'source_id' => $meta['record_id'] ?? $meta['source_id'] ?? null,
            'idempotency_key' => $idempotencyKey,
            'actor_id' => $meta['actor_id'] ?? null,
            'correlation_id' => $meta['correlation_id'] ?? null,
            'payload' => [
                'trigger_key' => $triggerKey,
                'vars' => array_merge(['name' => $recipient->name], $vars),
                'meta' => $meta,
                'recipient_instruction' => [
                    'user_ids' => [$recipient->id],
                    'include_acting' => (bool) ($meta['include_acting'] ?? false),
                    'include_delegates' => (bool) ($meta['include_delegates'] ?? false),
                ],
                'send_email' => $sendEmail,
                'send_push' => $sendPush,
            ],
        ]);

        $this->outbox->scheduleAfterCommit($outbox, true);

        $event = NotificationEvent::query()
            ->where('tenant_id', $recipient->tenant_id)
            ->where('idempotency_key', $idempotencyKey)
            ->first();

        if ($event) {
            $row = Notification::query()
                ->where('user_id', $recipient->id)
                ->where('event_id', $event->id)
                ->latest('id')
                ->first();
            if ($row) {
                return $row;
            }
        }

        return Notification::query()
            ->where('user_id', $recipient->id)
            ->where('trigger', $triggerKey)
            ->latest('id')
            ->firstOrFail();
    }

    public function publishEvent(array $data, bool $processInline = true): NotificationOutbox
    {
        $outbox = $this->outbox->enqueue($data);
        $this->outbox->scheduleAfterCommit($outbox, $processInline);

        return $outbox;
    }

    public function consumeOutboxId(int $outboxId): void
    {
        DB::transaction(function () use ($outboxId) {
            $locked = NotificationOutbox::query()->lockForUpdate()->find($outboxId);
            if (! $locked || $locked->status === 'published') {
                return;
            }

            $locked->update([
                'status' => 'processing',
                'attempts' => ((int) $locked->attempts) + 1,
            ]);

            try {
                $this->consumePayload($locked);
                $locked->update([
                    'status' => 'published',
                    'published_at' => now(),
                    'last_error' => null,
                ]);
                $this->outbox->audit($locked->tenant_id, 'outbox', $locked->id, 'published', $locked->actor_id);
            } catch (\Throwable $e) {
                $locked->update([
                    'status' => 'failed',
                    'last_error' => Str::limit($e->getMessage(), 2000),
                    'available_at' => now()->addMinutes(5),
                ]);

                NotificationDeadLetter::create([
                    'tenant_id' => $locked->tenant_id,
                    'outbox_id' => $locked->id,
                    'failure_code' => 'consume_error',
                    'failure_summary' => Str::limit($e->getMessage(), 2000),
                    'status' => 'open',
                ]);

                $this->outbox->audit($locked->tenant_id, 'outbox', $locked->id, 'failed', $locked->actor_id, [
                    'error' => Str::limit($e->getMessage(), 500),
                ]);
            }
        });
    }

    private function consumePayload(NotificationOutbox $outbox): void
    {
        $payload = $outbox->payload ?? [];
        $triggerKey = $payload['trigger_key'] ?? $outbox->event_type;
        $vars = $payload['vars'] ?? [];
        $meta = $this->links->sanitizeMeta($payload['meta'] ?? []);
        $meta['trigger'] = $triggerKey;

        // Idempotent event upsert
        $event = NotificationEvent::query()
            ->where('tenant_id', $outbox->tenant_id)
            ->where('idempotency_key', $outbox->idempotency_key)
            ->first();

        if (! $event) {
            $event = NotificationEvent::create([
                'tenant_id' => $outbox->tenant_id,
                'uuid' => (string) Str::uuid(),
                'outbox_id' => $outbox->id,
                'event_key' => $triggerKey,
                'event_type' => $outbox->event_type,
                'source_module' => $outbox->source_module,
                'source_type' => $outbox->source_type,
                'source_id' => $outbox->source_id,
                'source_reference_snapshot' => $meta['reference'] ?? ($vars['reference'] ?? null),
                'actor_id' => $outbox->actor_id,
                'occurred_at' => now(),
                'importance' => $meta['importance'] ?? 'normal',
                'confidentiality' => $meta['confidentiality'] ?? 'internal',
                'correlation_id' => $outbox->correlation_id,
                'idempotency_key' => $outbox->idempotency_key,
                'payload' => $payload,
                'status' => 'consumed',
            ]);
        }

        $policy = $this->policies->resolvePolicy((int) $outbox->tenant_id, $triggerKey);
        if (! $event->confidentiality || $event->confidentiality === 'internal') {
            $event->update([
                'confidentiality' => $policy['confidentiality'] ?? 'internal',
                'importance' => $policy['importance'] ?? $event->importance,
            ]);
        } else {
            $policy['confidentiality'] = $event->confidentiality;
        }

        $record = NotificationRecord::query()
            ->where('event_id', $event->id)
            ->where('notification_type', $triggerKey)
            ->first();

        if (! $record) {
            $record = NotificationRecord::create([
                'tenant_id' => $outbox->tenant_id,
                'uuid' => (string) Str::uuid(),
                'event_id' => $event->id,
                'notification_type' => $triggerKey,
                'template_key' => $policy['template_key'] ?? $triggerKey,
                'importance' => $policy['importance'],
                'confidentiality' => $policy['confidentiality'],
                'delivery_class' => $policy['delivery_class'],
                'action_required' => (bool) ($policy['action_required'] ?? false),
                'secure_route' => $this->links->normalizeRoute($meta['secure_route'] ?? $meta['url'] ?? null),
                'status' => 'active',
            ]);
        }

        $instruction = $payload['recipient_instruction'] ?? ['user_ids' => []];
        $resolved = $this->recipients->resolve((int) $outbox->tenant_id, $instruction);

        $sendEmail = (bool) ($payload['send_email'] ?? true);
        $sendPush = (bool) ($payload['send_push'] ?? ($policy['push_enabled'] ?? false));

        foreach ($resolved as $entry) {
            /** @var User $user */
            $user = $entry['user'];

            // Advanced coalescing — never delay critical / action / mandatory notices.
            $coalesce = app(CoalescingService::class);
            if ($coalesce->shouldCoalesce($policy, $meta)) {
                $coalesce->enqueue(
                    $user,
                    $triggerKey,
                    (string) ($vars['summary'] ?? $vars['title'] ?? $triggerKey),
                    ['meta' => $meta, 'vars' => $vars],
                    $meta['coalesce_key'] ?? null,
                );
                continue;
            }

            $this->deliverToRecipient($user, $entry, $event, $record, $policy, $vars, $meta, $sendEmail, $sendPush);
        }
    }

    private function deliverToRecipient(
        User $user,
        array $entry,
        NotificationEvent $event,
        NotificationRecord $record,
        array $policy,
        array $vars,
        array $meta,
        bool $sendEmail,
        bool $sendPush,
    ): void {
        $recipientRow = NotificationRecipient::query()
            ->where('notification_record_id', $record->id)
            ->where('user_id', $user->id)
            ->first();

        if ($recipientRow) {
            // Already delivered for this logical notification — idempotent no-op.
            return;
        }

        $channels = $this->policies->channelDecisions($user, $policy);
        $locale = $channels['language'] ?? 'en';
        $template = $this->templates->resolve((int) $user->tenant_id, $policy['template_key'] ?? $event->event_key, $locale);
        $perVars = array_merge($vars, ['name' => $user->name]);
        $rendered = $this->templates->render($template, $perVars, $policy['confidentiality'] ?? 'internal');

        $recipientRow = NotificationRecipient::create([
            'tenant_id' => $user->tenant_id,
            'notification_record_id' => $record->id,
            'user_id' => $user->id,
            'recipient_role' => $entry['role'] ?? null,
            'language' => $locale,
            'resolution_reason' => $entry['reason'] ?? null,
            'resolved_at' => now(),
            'status' => 'active',
        ]);

        $inApp = null;
        if ($channels['in_app']) {
            $inApp = $this->channels->deliverInApp(
                $user,
                $rendered,
                $policy,
                $meta,
                $event->id,
                $rendered['template_version_id'] ?? null,
            );
            $recipientRow->update(['in_app_notification_id' => $inApp->id]);

            $inAppDelivery = $this->channels->createDelivery(
                (int) $user->tenant_id,
                $recipientRow->id,
                'in_app',
                $policy,
                $rendered,
                'inbox',
                $rendered['template_version_id'] ?? null,
            );
            $inAppDelivery->update(['status' => 'delivered', 'delivered_at' => now(), 'sent_at' => now()]);
        }

        $secureUrl = $this->links->absoluteSecureUrl($record->secure_route);

        if ($sendEmail && ($channels['email'] || $channels['digest'])) {
            $emailDelivery = $this->channels->createDelivery(
                (int) $user->tenant_id,
                $recipientRow->id,
                'email',
                $policy,
                $rendered,
                $user->email,
                $rendered['template_version_id'] ?? null,
                $channels['quiet_hours_defer'] ? now()->addHours(8) : null,
            );

            if ($channels['digest']) {
                $digestType = 'daily';
                $pref = \App\Models\Notifications\NotificationPreference::query()
                    ->where('user_id', $user->id)
                    ->where('category', $policy['category'] ?? 'operational')
                    ->first();
                if ($pref && $pref->digest_mode === 'weekly') {
                    $digestType = 'weekly';
                }
                $this->channels->enqueueDigestItem($user, $emailDelivery, $rendered['subject'], $digestType);
            } elseif ($channels['email'] && ! $channels['quiet_hours_defer']) {
                $this->channels->attemptEmail($emailDelivery, $user, $rendered['body'], $secureUrl);
            }
        }

        if ($sendPush && $channels['push']) {
            $pushDelivery = $this->channels->createDelivery(
                (int) $user->tenant_id,
                $recipientRow->id,
                'push',
                $policy,
                $rendered,
                'device',
                $rendered['template_version_id'] ?? null,
            );
            $this->channels->attemptPush($pushDelivery, $user, $rendered, array_merge($meta, [
                'confidentiality' => $policy['confidentiality'] ?? 'internal',
            ]));
        }

        // SMS / WhatsApp — Null stubs only (Governance Configuration Pending). Never live without credentials.
        if (($policy['sms_enabled'] ?? false) && config('notifications.sms_enabled')) {
            $sms = $this->channels->createDelivery(
                (int) $user->tenant_id,
                $recipientRow->id,
                'sms',
                $policy,
                $rendered,
                $user->phone ?? null,
                $rendered['template_version_id'] ?? null,
            );
            $this->channels->attemptSms($sms, (string) ($user->phone ?? ''), $rendered['subject'] ?? '');
        }
        if (($policy['whatsapp_enabled'] ?? false) && config('notifications.whatsapp_enabled')) {
            $wa = $this->channels->createDelivery(
                (int) $user->tenant_id,
                $recipientRow->id,
                'whatsapp',
                $policy,
                $rendered,
                $user->phone ?? null,
                $rendered['template_version_id'] ?? null,
            );
            $this->channels->attemptWhatsApp($wa, (string) ($user->phone ?? ''), $rendered['subject'] ?? '');
        }

        // SMS / WhatsApp stubs documented — not created unless explicitly enabled above.
        $this->outbox->audit($user->tenant_id, 'notification_recipient', $recipientRow->id, 'delivered', null, [
            'user_id' => $user->id,
            'event_key' => $event->event_key,
        ]);
    }

    private function legacyIdempotencyKey(User $recipient, string $triggerKey, array $meta): string
    {
        $parts = [
            $triggerKey,
            $recipient->id,
            $meta['record_id'] ?? $meta['source_id'] ?? '',
            $meta['correlation_id'] ?? '',
            // Allow natural uniqueness per logical occurrence when caller omits key:
            // include minute bucket for non-idempotent legacy callers without record_id.
            ($meta['record_id'] ?? null) ? '' : now()->format('YmdHi'),
        ];

        return 'legacy:'.hash('sha256', implode('|', $parts));
    }

    public function processRetries(int $limit = 50): int
    {
        $due = NotificationChannelDelivery::query()
            ->where('status', 'retry_scheduled')
            ->where('suppressed', false)
            ->whereIn('id', function ($q) {
                $q->select('channel_delivery_id')
                    ->from('notification_delivery_attempts')
                    ->whereNotNull('next_retry_at')
                    ->where('next_retry_at', '<=', now());
            })
            ->limit($limit)
            ->get();

        $count = 0;
        foreach ($due as $delivery) {
            $recipientRow = NotificationRecipient::find($delivery->recipient_id);
            $user = $recipientRow ? User::find($recipientRow->user_id) : null;
            if (! $user) {
                continue;
            }
            $secureUrl = $this->links->absoluteSecureUrl('/notifications');
            $this->channels->retry($delivery, $user, 'Retry delivery — sign in to Nexus for details.', $secureUrl);
            $count++;
        }

        return $count;
    }
}
