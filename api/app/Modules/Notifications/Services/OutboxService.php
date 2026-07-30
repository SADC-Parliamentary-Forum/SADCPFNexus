<?php

namespace App\Modules\Notifications\Services;

use App\Models\Notifications\NotificationAuditEvent;
use App\Models\Notifications\NotificationOutbox;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OutboxService
{
    /**
     * Persist a notification event into the transactional outbox.
     * Call inside the same DB transaction as the business write.
     */
    public function enqueue(array $data): NotificationOutbox
    {
        $tenantId = (int) $data['tenant_id'];
        $idempotencyKey = (string) $data['idempotency_key'];

        $existing = NotificationOutbox::query()
            ->where('tenant_id', $tenantId)
            ->where('idempotency_key', $idempotencyKey)
            ->first();

        if ($existing) {
            return $existing;
        }

        return NotificationOutbox::create([
            'tenant_id' => $tenantId,
            'uuid' => (string) Str::uuid(),
            'event_type' => $data['event_type'],
            'source_module' => $data['source_module'],
            'source_type' => $data['source_type'] ?? null,
            'source_id' => $data['source_id'] ?? null,
            'idempotency_key' => $idempotencyKey,
            'schema_version' => $data['schema_version'] ?? '1',
            'actor_id' => $data['actor_id'] ?? null,
            'correlation_id' => $data['correlation_id'] ?? null,
            'payload' => $data['payload'] ?? [],
            'status' => 'pending',
            'attempts' => 0,
            'available_at' => $data['available_at'] ?? now(),
        ]);
    }

    /**
     * After the business transaction commits, process or queue consumption.
     */
    public function scheduleAfterCommit(NotificationOutbox $outbox, bool $processInline = true): void
    {
        $id = $outbox->id;

        $runner = function () use ($id, $processInline) {
            if ($processInline || config('queue.default') === 'sync') {
                app(NotificationDispatchService::class)->consumeOutboxId($id);
                return;
            }

            \App\Jobs\ProcessNotificationOutboxJob::dispatch($id)->onQueue(
                $this->queueForPriority('normal')
            );
        };

        if (DB::transactionLevel() > 0) {
            DB::afterCommit($runner);
        } else {
            $runner();
        }
    }

    public function queueForPriority(string $priority): string
    {
        return match ($priority) {
            'critical' => 'notifications-critical',
            'digest' => 'notifications-digest',
            default => 'notifications',
        };
    }

    public function audit(int $tenantId, string $entityType, ?int $entityId, string $action, ?int $actorId = null, ?array $payload = null): void
    {
        NotificationAuditEvent::create([
            'tenant_id' => $tenantId,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'action' => $action,
            'actor_id' => $actorId,
            'payload' => $payload,
            'occurred_at' => now(),
        ]);
    }
}
