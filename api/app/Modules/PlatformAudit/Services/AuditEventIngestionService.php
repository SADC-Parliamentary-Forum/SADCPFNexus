<?php

namespace App\Modules\PlatformAudit\Services;

use App\Models\PlatformAudit\AuditEvent;
use App\Models\PlatformAudit\AuditEventActor;
use App\Models\PlatformAudit\AuditEventAuthoritySnapshot;
use App\Models\PlatformAudit\AuditEventChange;
use App\Models\PlatformAudit\AuditEventContext;
use App\Models\PlatformAudit\AuditEventDeadLetter;
use App\Models\PlatformAudit\AuditEventIntegrityRecord;
use App\Models\PlatformAudit\AuditEventOutbox;
use App\Models\PlatformAudit\AuditEventSubject;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Throwable;

/**
 * Phase 1 ingestion: transactional outbox + append-only store + idempotency.
 */
class AuditEventIngestionService
{
    public function __construct(
        private readonly EventTypeRegistryService $registry,
        private readonly SensitiveFieldMasker $masker,
        private readonly AuditEventContractValidator $contract,
    ) {}

    /**
     * Write an outbox row, then commit into the immutable store.
     * Use enqueue() when the producer needs an outbox-only asynchronous write.
     *
     * @param  array<string, mixed>  $input
     */
    public function ingest(array $input, bool $sync = true): AuditEvent
    {
        if (! Schema::hasTable('audit_events')) {
            throw new \RuntimeException('Platform audit store is not migrated yet.');
        }

        $uuid = (string) ($input['uuid'] ?? Str::uuid());
        $tenantId = (int) ($input['tenant_id'] ?? auth()->user()?->tenant_id ?? 0);
        $eventKey = (string) ($input['event_key'] ?? $input['event_type'] ?? null);
        $payload = null;
        try {
            $this->registry->ensureSeeded();
            $input['uuid'] = $uuid;
            $input = $this->contract->normalize($input, $this->registry);

            $idempotencyKey = $input['idempotency_key'] ?? null;
            $tenantId = (int) $input['tenant_id'];
            $eventKey = (string) $input['event_key'];

            if ($idempotencyKey) {
                $existing = AuditEvent::query()
                    ->where('tenant_id', $tenantId)
                    ->where('idempotency_key', $idempotencyKey)
                    ->first();
                if ($existing) {
                    return $existing;
                }
            }

            $byUuid = AuditEvent::query()->where('uuid', $uuid)->first();
            if ($byUuid) {
                return $byUuid;
            }

            $payload = [
                'uuid' => $uuid,
                'idempotency_key' => $idempotencyKey,
                'tenant_id' => $tenantId,
                'event_key' => $eventKey,
                'input' => $input,
            ];

            return DB::transaction(function () use ($payload, $sync, $tenantId, $uuid, $eventKey, $idempotencyKey) {
                $outbox = AuditEventOutbox::query()->create([
                    'tenant_id' => $tenantId,
                    'event_uuid' => $uuid,
                    'idempotency_key' => $idempotencyKey,
                    'event_key' => $eventKey,
                    'payload' => $payload,
                    'status' => 'pending',
                    'attempts' => 0,
                    'available_at' => now(),
                ]);

                if (! $sync) {
                    return $this->commitFromOutbox($outbox);
                }

                return $this->commitFromOutbox($outbox);
            });
        } catch (Throwable $e) {
            $this->deadLetter($tenantId, $uuid, $eventKey, $payload ?? ['input' => $input], $e->getMessage());
            throw $e;
        }
    }

    /**
     * Store an event in the transactional outbox without appending it immediately.
     *
     * @param  array<string, mixed>  $input
     */
    public function enqueue(array $input): AuditEventOutbox
    {
        if (! Schema::hasTable('audit_events')) {
            throw new \RuntimeException('Platform audit store is not migrated yet.');
        }

        $uuid = (string) ($input['uuid'] ?? Str::uuid());
        $tenantId = (int) ($input['tenant_id'] ?? auth()->user()?->tenant_id ?? 0);
        $eventKey = (string) ($input['event_key'] ?? $input['event_type'] ?? null);
        $payload = null;

        try {
            $this->registry->ensureSeeded();
            $input['uuid'] = $uuid;
            $input['outcome'] = $input['outcome'] ?? 'queued';
            $input = $this->contract->normalize($input, $this->registry);

            $tenantId = (int) $input['tenant_id'];
            $eventKey = (string) $input['event_key'];
            $idempotencyKey = $input['idempotency_key'] ?? null;

            $payload = [
                'uuid' => $uuid,
                'idempotency_key' => $idempotencyKey,
                'tenant_id' => $tenantId,
                'event_key' => $eventKey,
                'input' => $input,
            ];

            $query = AuditEventOutbox::query()
                ->where('tenant_id', $tenantId)
                ->where(function ($q) use ($uuid, $idempotencyKey) {
                    $q->where('event_uuid', $uuid);
                    if ($idempotencyKey) {
                        $q->orWhere('idempotency_key', $idempotencyKey);
                    }
                });

            if ($existing = $query->first()) {
                return $existing;
            }

            return AuditEventOutbox::query()->create([
                'tenant_id' => $tenantId,
                'event_uuid' => $uuid,
                'idempotency_key' => $idempotencyKey,
                'event_key' => $eventKey,
                'payload' => $payload,
                'status' => 'pending',
                'attempts' => 0,
                'available_at' => now(),
            ]);
        } catch (Throwable $e) {
            $this->deadLetter($tenantId, $uuid, $eventKey, $payload ?? ['input' => $input], $e->getMessage());
            throw $e;
        }
    }

    /**
     * @return array{processed:int, committed:int, failed:int, dead_lettered:int}
     */
    public function processPending(int $tenantId, int $limit = 100): array
    {
        $stats = ['processed' => 0, 'committed' => 0, 'failed' => 0, 'dead_lettered' => 0];

        $rows = AuditEventOutbox::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('status', ['pending', 'failed'])
            ->where('attempts', '<', 3)
            ->where(function ($q) {
                $q->whereNull('available_at')->orWhere('available_at', '<=', now());
            })
            ->orderBy('id')
            ->limit(max(1, min($limit, 500)))
            ->get();

        foreach ($rows as $outbox) {
            $stats['processed']++;
            try {
                $this->commitFromOutbox($outbox);
                $stats['committed']++;
            } catch (Throwable) {
                $fresh = $outbox->fresh();
                if ($fresh?->status === 'dead_lettered') {
                    $stats['dead_lettered']++;
                } else {
                    $stats['failed']++;
                }
            }
        }

        return $stats;
    }

    public function commitFromOutbox(AuditEventOutbox $outbox): AuditEvent
    {
        $outbox->attempts = (int) $outbox->attempts + 1;
        $outbox->status = 'processing';
        $outbox->save();

        try {
            $event = $this->appendImmutable($outbox->payload['input'] ?? [], $outbox->event_uuid, $outbox->idempotency_key);
            $outbox->status = 'committed';
            $outbox->processed_at = now();
            $outbox->last_error = null;
            $outbox->save();

            if (! (bool) ($outbox->payload['input']['suppress_monitoring'] ?? false)) {
                try {
                    app(SecurityMonitoringService::class)->evaluateEvent($event);
                } catch (Throwable $monitorError) {
                    Log::warning('platform_audit.monitoring_eval_failed', [
                        'event_id' => $event->id,
                        'error' => $monitorError->getMessage(),
                    ]);
                }
            }

            return $event;
        } catch (Throwable $e) {
            $outbox->status = 'failed';
            $outbox->last_error = $e->getMessage();
            $outbox->save();

            if ($outbox->attempts >= 3) {
                $outbox->status = 'dead_lettered';
                $outbox->save();
                $this->deadLetter(
                    (int) $outbox->tenant_id,
                    $outbox->event_uuid,
                    $outbox->event_key,
                    $outbox->payload,
                    $e->getMessage(),
                    $outbox->id
                );
            }

            throw $e;
        }
    }

    /**
     * @param  array<string, mixed>  $input
     */
    public function appendImmutable(array $input, ?string $uuid = null, ?string $idempotencyKey = null): AuditEvent
    {
        $this->registry->ensureSeeded();
        $input = $this->contract->normalize($input, $this->registry);

        $uuid = $uuid ?? (string) ($input['uuid'] ?? Str::uuid());
        $idempotencyKey = $idempotencyKey ?? ($input['idempotency_key'] ?? null);
        $tenantId = (int) $input['tenant_id'];
        $eventKey = (string) $input['event_key'];
        $type = $this->registry->resolveOrRegister($eventKey, $input['category'] ?? null);

        if ($idempotencyKey) {
            $existing = AuditEvent::query()
                ->where('tenant_id', $tenantId)
                ->where('idempotency_key', $idempotencyKey)
                ->first();
            if ($existing) {
                return $existing;
            }
        }

        $byUuid = AuditEvent::query()->where('uuid', $uuid)->first();
        if ($byUuid) {
            return $byUuid;
        }

        $actorType = (string) ($input['actor_type'] ?? 'human');
        $actorId = array_key_exists('actor_id', $input) ? $input['actor_id'] : auth()->id();
        $actorSnapshot = $input['actor_snapshot'] ?? $this->buildActorSnapshot($actorId, $actorType);
        $subjectType = $input['subject_type'] ?? $input['auditable_type'] ?? null;
        $subjectId = $input['subject_id'] ?? $input['auditable_id'] ?? null;

        $oldScrub = $this->masker->scrub($input['old_values'] ?? null);
        $newScrub = $this->masker->scrub($input['new_values'] ?? $input['payload'] ?? null);
        $changes = $input['changes'] ?? $this->masker->buildChanges($input['old_values'] ?? null, $input['new_values'] ?? null);

        $request = request();
        $occurredAt = $input['occurred_at'] ?? now();
        $previous = AuditEvent::query()
            ->where('tenant_id', $tenantId)
            ->orderByDesc('sequence_number')
            ->lockForUpdate()
            ->first();
        $sequence = $previous ? ((int) $previous->sequence_number + 1) : 1;
        $previousHash = $previous?->event_hash ?? '0';

        $canonical = [
            'uuid' => $uuid,
            'tenant_id' => $tenantId,
            'sequence_number' => $sequence,
            'event_key' => $eventKey,
            'schema_version' => (int) ($input['schema_version'] ?? $type->effective_version ?? 1),
            'outcome' => $input['outcome'] ?? 'success',
            'occurred_at' => (string) $occurredAt,
            'actor_type' => $actorType,
            'actor_id' => $actorId,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'source_module' => $input['source_module'] ?? null,
            'action' => $input['action'] ?? $eventKey,
            'payload' => $newScrub['values'],
            'previous_event_hash' => $previousHash,
        ];
        $eventHash = hash('sha256', json_encode($canonical, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES).$previousHash);

        $event = AuditEvent::query()->create([
            'uuid' => $uuid,
            'tenant_id' => $tenantId,
            'sequence_number' => $sequence,
            'event_type_id' => $type->id,
            'event_key' => $eventKey,
            'schema_version' => (int) ($input['schema_version'] ?? 1),
            'producer_version' => $input['producer_version'] ?? 'platform-audit-trail@1',
            'category' => $type->category,
            'severity' => $type->severity,
            'outcome' => $input['outcome'] ?? 'success',
            'occurred_at' => $occurredAt,
            'received_at' => now(),
            'actor_type' => $actorType,
            'actor_id' => $actorId,
            'actor_snapshot' => $actorSnapshot,
            'principal_id' => $input['principal_id'] ?? null,
            'delegation_id' => $input['delegation_id'] ?? null,
            'acting_appointment_id' => $input['acting_appointment_id'] ?? null,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'subject_snapshot' => $input['subject_snapshot'] ?? null,
            'source_module' => $input['source_module'] ?? null,
            'action' => $input['action'] ?? $eventKey,
            'reason' => $input['reason'] ?? null,
            'correlation_id' => $input['correlation_id'] ?? null,
            'causation_event_id' => $input['causation_event_id'] ?? null,
            'request_id' => $input['request_id'] ?? ($request?->headers->get('X-Request-Id')),
            'session_reference' => $input['session_reference'] ?? null,
            'ip_address' => array_key_exists('ip_address', $input) ? $input['ip_address'] : $request?->ip(),
            'user_agent' => array_key_exists('user_agent', $input) ? $input['user_agent'] : $request?->userAgent(),
            'channel' => $input['channel'] ?? 'web',
            'payload' => [
                'data' => $newScrub['values'],
                'redactions' => array_merge($oldScrub['redactions'], $newScrub['redactions']),
                'legacy' => $input['legacy_meta'] ?? null,
            ],
            'previous_event_hash' => $previousHash,
            'event_hash' => $eventHash,
            'retention_class' => $input['retention_class'] ?? $type->retention_class ?? 'standard',
            'confidentiality' => $input['confidentiality'] ?? 'internal',
            'idempotency_key' => $idempotencyKey,
            'migration_status' => $input['migration_status'] ?? null,
            'legacy_audit_log_id' => $input['legacy_audit_log_id'] ?? null,
            'created_at' => now(),
        ]);

        AuditEventActor::query()->create([
            'audit_event_id' => $event->id,
            'person_id' => $actorSnapshot['person_id'] ?? null,
            'account_id' => $actorId,
            'display_name' => $actorSnapshot['display_name'] ?? null,
            'employee_number' => $actorSnapshot['employee_number'] ?? null,
            'position_id' => $actorSnapshot['position_id'] ?? null,
            'position_title' => $actorSnapshot['position_title'] ?? null,
            'department_id' => $actorSnapshot['department_id'] ?? null,
            'department_name' => $actorSnapshot['department_name'] ?? null,
            'roles_used' => $actorSnapshot['roles_used'] ?? null,
            'authority_id' => $input['authority_id'] ?? null,
            'authority_scope' => $input['authority_scope'] ?? null,
            'delegation_reference' => $input['delegation_reference'] ?? null,
            'acting_reference' => $input['acting_reference'] ?? null,
            'authentication_strength' => $input['authentication_strength'] ?? null,
            'created_at' => now(),
        ]);

        if ($subjectType) {
            AuditEventSubject::query()->create([
                'audit_event_id' => $event->id,
                'subject_type' => $subjectType,
                'subject_id' => $subjectId,
                'business_reference' => $input['business_reference'] ?? null,
                'display_label' => $input['subject_label'] ?? class_basename((string) $subjectType).'#'.$subjectId,
                'snapshot' => $input['subject_snapshot'] ?? null,
                'created_at' => now(),
            ]);
        }

        AuditEventContext::query()->create([
            'audit_event_id' => $event->id,
            'request_id' => $event->request_id,
            'session_reference' => $event->session_reference,
            'ip_address' => $event->ip_address,
            'user_agent' => $event->user_agent,
            'channel' => $event->channel,
            'url' => array_key_exists('url', $input) ? $input['url'] : $request?->fullUrl(),
            'extra' => $input['context_extra'] ?? null,
            'created_at' => now(),
        ]);

        AuditEventAuthoritySnapshot::query()->create([
            'audit_event_id' => $event->id,
            'roles' => $actorSnapshot['roles_used'] ?? null,
            'permissions_used' => $input['permissions_used'] ?? null,
            'authority_grants' => $input['authority_grants'] ?? null,
            'delegation' => isset($input['delegation_id']) || isset($input['principal_id'])
                ? [
                    'principal_id' => $input['principal_id'] ?? null,
                    'delegation_id' => $input['delegation_id'] ?? null,
                    'delegation_reference' => $input['delegation_reference'] ?? null,
                ]
                : null,
            'acting_appointment' => isset($input['acting_appointment_id'])
                ? [
                    'acting_appointment_id' => $input['acting_appointment_id'],
                    'acting_reference' => $input['acting_reference'] ?? null,
                ]
                : null,
            'created_at' => now(),
        ]);

        foreach ($changes as $change) {
            AuditEventChange::query()->create(array_merge($change, [
                'audit_event_id' => $event->id,
                'created_at' => now(),
            ]));
        }

        AuditEventIntegrityRecord::query()->create([
            'audit_event_id' => $event->id,
            'canonical_payload_hash' => hash('sha256', json_encode($canonical, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: ''),
            'previous_hash' => $previousHash,
            'event_hash' => $eventHash,
            'algorithm' => 'sha256',
            'key_reference' => 'platform-local-sha256',
            'verification_status' => 'pending',
            'created_at' => now(),
        ]);

        return $event->fresh(['changes', 'actorDetail', 'subjectDetail', 'context', 'authoritySnapshot', 'integrityRecord']);
    }

    /**
     * Compatibility path for AuditLog::record().
     *
     * @param  array<string, mixed>  $context
     */
    public function ingestFromLegacy(string $legacyEvent, array $context, ?int $legacyAuditLogId = null): ?AuditEvent
    {
        if (! Schema::hasTable('audit_events')) {
            return null;
        }

        try {
            $mapped = app(LegacyEventMapper::class)->map($legacyEvent, $context);

            return $this->ingest(array_merge($mapped, [
                'legacy_audit_log_id' => $legacyAuditLogId,
                'legacy_meta' => [
                    'legacy_event' => $legacyEvent,
                    'tags' => $context['tags'] ?? null,
                ],
                'idempotency_key' => $context['idempotency_key']
                    ?? ($legacyAuditLogId ? 'legacy:'.$legacyAuditLogId : 'legacy-live:'.hash('sha256', $legacyEvent.'|'.json_encode([
                        'type' => $context['auditable_type'] ?? null,
                        'id' => $context['auditable_id'] ?? null,
                        'ts' => microtime(true),
                        'rand' => Str::random(8),
                    ]))),
            ]));
        } catch (Throwable $e) {
            Log::warning('platform_audit.legacy_ingest_failed', [
                'legacy_event' => $legacyEvent,
                'error' => $e->getMessage(),
            ]);
            $this->deadLetter(
                (int) (auth()->user()?->tenant_id ?? $context['tenant_id'] ?? 0) ?: 0,
                (string) Str::uuid(),
                $legacyEvent,
                ['legacy_event' => $legacyEvent, 'context' => $context],
                $e->getMessage()
            );

            return null;
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function buildActorSnapshot(?int $actorId, string $actorType): array
    {
        if ($actorType === 'anonymous' || ! $actorId) {
            return [
                'display_name' => $actorType === 'service' ? 'Service' : 'Anonymous',
                'roles_used' => [],
            ];
        }

        $user = User::query()->with(['roles', 'department', 'position'])->find($actorId);
        if (! $user) {
            return ['account_id' => $actorId, 'display_name' => 'Unknown'];
        }

        return [
            'person_id' => $user->person_id ?? null,
            'account_id' => $user->id,
            'display_name' => $user->name,
            'employee_number' => $user->employee_number ?? null,
            'position_id' => $user->position_id ?? null,
            'position_title' => $user->position?->title ?? $user->position?->name ?? null,
            'department_id' => $user->department_id ?? null,
            'department_name' => $user->department?->name ?? null,
            'roles_used' => $user->roles?->pluck('name')->values()->all() ?? [],
        ];
    }

    /**
     * @param  array<string, mixed>|null  $payload
     */
    private function deadLetter(
        int $tenantId,
        ?string $uuid,
        ?string $eventKey,
        ?array $payload,
        string $error,
        ?int $outboxId = null
    ): void {
        if (! Schema::hasTable('audit_event_dead_letters') || $tenantId <= 0) {
            return;
        }

        $safePayload = null;
        if ($payload !== null) {
            $scrubbed = $this->masker->scrub($payload);
            $safePayload = $scrubbed['values'];
            if ($scrubbed['redactions'] !== []) {
                $safePayload['_redactions'] = $scrubbed['redactions'];
            }
        }

        AuditEventDeadLetter::query()->create([
            'tenant_id' => $tenantId,
            'event_uuid' => $uuid,
            'outbox_id' => $outboxId,
            'event_key' => $eventKey,
            'payload' => $safePayload,
            'error_message' => $error,
            'status' => 'open',
        ]);
    }
}
