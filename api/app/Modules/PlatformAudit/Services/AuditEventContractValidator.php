<?php

namespace App\Modules\PlatformAudit\Services;

use App\Models\PlatformAudit\AuditEventSchemaVersion;
use Illuminate\Validation\ValidationException;

/**
 * Validates the internal producer contract before an event reaches the outbox.
 */
class AuditEventContractValidator
{
    private const ACTOR_TYPES = ['human', 'service', 'anonymous'];

    /** @var array<string, string> */
    private const OUTCOME_ALIASES = [
        'failure' => 'failed',
        'fail' => 'failed',
        'partially completed' => 'partially_completed',
        'partial' => 'partially_completed',
        'timed out' => 'timed_out',
        'timeout' => 'timed_out',
        'skipped' => 'skipped_by_approved_rule',
    ];

    private const OUTCOMES = [
        'success',
        'failed',
        'denied',
        'partially_completed',
        'cancelled',
        'reversed',
        'superseded',
        'timed_out',
        'queued',
        'retried',
        'skipped_by_approved_rule',
    ];

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function normalize(array $input, EventTypeRegistryService $registry): array
    {
        $eventKey = trim((string) ($input['event_key'] ?? $input['event_type'] ?? ''));
        if ($eventKey === '') {
            $this->fail('event_key', 'A controlled event key is required.');
        }

        $type = $registry->findByKey($eventKey);
        if (! $type || $type->status !== 'active') {
            $this->fail('event_key', 'The event key is not registered in the platform audit event registry.');
        }

        $schemaVersion = (int) ($input['schema_version'] ?? $type->effective_version ?? 1);
        if ($schemaVersion < 1) {
            $this->fail('schema_version', 'The event schema version must be a positive integer.');
        }

        $schemaRegistered = AuditEventSchemaVersion::query()
            ->where('audit_event_type_id', $type->id)
            ->where('schema_version', $schemaVersion)
            ->exists();

        if (! $schemaRegistered) {
            $this->fail('schema_version', 'The event schema version is not registered for this event key.');
        }

        $tenantId = (int) ($input['tenant_id'] ?? auth()->user()?->tenant_id ?? 0);
        if ($tenantId <= 0) {
            $this->fail('tenant_id', 'A tenant-scoped audit event must identify its tenant.');
        }

        $actorType = strtolower((string) ($input['actor_type'] ?? 'human'));
        if (! in_array($actorType, self::ACTOR_TYPES, true)) {
            $this->fail('actor_type', 'The actor type must be human, service, or anonymous.');
        }

        $actorId = array_key_exists('actor_id', $input)
            ? $input['actor_id']
            : ($actorType === 'human' ? auth()->id() : null);
        if ($actorType === 'human' && ! $actorId) {
            $this->fail('actor_id', 'Human audit events must identify the authenticated account.');
        }

        $outcome = strtolower(str_replace('-', '_', (string) ($input['outcome'] ?? 'success')));
        $outcome = self::OUTCOME_ALIASES[$outcome] ?? $outcome;
        if (! in_array($outcome, self::OUTCOMES, true)) {
            $this->fail('outcome', 'The event outcome is not part of the controlled outcome vocabulary.');
        }

        $input['tenant_id'] = $tenantId;
        $input['event_key'] = $eventKey;
        $input['event_type'] = $eventKey;
        $input['schema_version'] = $schemaVersion;
        $input['actor_type'] = $actorType;
        $input['actor_id'] = $actorId;
        $input['outcome'] = $outcome;
        $input['source_module'] = $input['source_module'] ?? $this->sourceModuleFor($eventKey);
        $input['occurred_at'] = $input['occurred_at'] ?? now();
        $input['producer_version'] = $input['producer_version'] ?? 'platform-audit-trail@1';

        return $input;
    }

    private function sourceModuleFor(string $eventKey): string
    {
        $prefix = explode('.', $eventKey)[0] ?? 'platform';

        return match ($prefix) {
            'pif' => 'programme',
            'audit', 'forensic', 'retention' => 'platform-audit',
            'auth' => 'auth',
            'identity' => 'access-control',
            'system' => 'platform',
            default => $prefix,
        };
    }

    private function fail(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => [$message]]);
    }
}
