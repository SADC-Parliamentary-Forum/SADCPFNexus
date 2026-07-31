<?php

namespace App\Modules\PlatformAudit\Services;

use App\Models\PlatformAudit\AuditEvent;
use App\Models\PlatformAudit\ForensicCase;
use App\Models\PlatformAudit\ForensicCaseEvent;
use App\Models\PlatformAudit\ForensicEvidencePackage;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ForensicCaseService
{
    public function __construct(
        private readonly AuditHoldService $holds,
    ) {}

    public function create(int $tenantId, User $actor, array $data): ForensicCase
    {
        $case = ForensicCase::query()->create([
            'tenant_id' => $tenantId,
            'uuid' => (string) Str::uuid(),
            'reference' => $data['reference'] ?? ('FC-'.strtoupper(Str::random(8))),
            'title' => $data['title'],
            'status' => 'open',
            'opened_by' => $actor->id,
            'custody_holder_id' => $data['custody_holder_id'] ?? $actor->id,
            'notes' => $data['notes'] ?? null,
            'custody_notes' => $data['custody_notes'] ?? 'Opened; custody with opener.',
        ]);

        app(AuditEventIngestionService::class)->ingest([
            'tenant_id' => $tenantId,
            'event_key' => 'forensic.case.opened',
            'actor_id' => $actor->id,
            'actor_type' => 'human',
            'outcome' => 'success',
            'source_module' => 'platform-audit',
            'subject_type' => ForensicCase::class,
            'subject_id' => $case->id,
            'new_values' => ['reference' => $case->reference, 'title' => $case->title],
            'idempotency_key' => 'forensic-open:'.$case->uuid,
        ]);

        return $case;
    }

    public function linkEvent(ForensicCase $case, int $eventId, User $actor, ?string $notes = null): ForensicCaseEvent
    {
        $event = AuditEvent::query()
            ->where('tenant_id', $case->tenant_id)
            ->findOrFail($eventId);

        return ForensicCaseEvent::query()->firstOrCreate(
            [
                'forensic_case_id' => $case->id,
                'audit_event_id' => $event->id,
            ],
            [
                'linked_by' => $actor->id,
                'linked_at' => now(),
                'notes' => $notes,
            ]
        );
    }

    public function applyHold(ForensicCase $case, User $actor, array $data): \App\Models\PlatformAudit\AuditEventHold
    {
        return $this->holds->place((int) $case->tenant_id, $actor, [
            'hold_type' => $data['hold_type'] ?? 'investigation',
            'scope_type' => $data['scope_type'] ?? 'subject',
            'scope_value' => $data['scope_value'] ?? (ForensicCase::class.':'.$case->id),
            'audit_event_id' => $data['audit_event_id'] ?? null,
            'reason' => $data['reason'] ?? ('Forensic case '.$case->reference),
        ]);
    }

    public function sealEvidencePackage(ForensicCase $case, User $actor): ForensicEvidencePackage
    {
        $links = ForensicCaseEvent::query()
            ->where('forensic_case_id', $case->id)
            ->orderBy('audit_event_id')
            ->get();

        if ($links->isEmpty()) {
            throw ValidationException::withMessages([
                'events' => ['Link at least one audit event before sealing an evidence package.'],
            ]);
        }

        $events = AuditEvent::query()
            ->whereIn('id', $links->pluck('audit_event_id'))
            ->orderBy('sequence_number')
            ->get();

        $entries = $events->map(fn (AuditEvent $e) => [
            'audit_event_id' => $e->id,
            'uuid' => $e->uuid,
            'event_key' => $e->event_key,
            'sequence_number' => $e->sequence_number,
            'event_hash' => $e->event_hash,
            'occurred_at' => optional($e->occurred_at)?->toIso8601String(),
        ])->values()->all();

        $manifest = [
            'forensic_case_id' => $case->id,
            'forensic_reference' => $case->reference,
            'sealed_at' => now()->toIso8601String(),
            'sealed_by' => $actor->id,
            'custody_holder_id' => $case->custody_holder_id,
            'events' => $entries,
        ];

        $canonical = json_encode($manifest, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $hash = hash('sha256', (string) $canonical);

        return DB::transaction(function () use ($case, $actor, $manifest, $hash, $entries) {
            $pkg = ForensicEvidencePackage::query()->create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $case->tenant_id,
                'forensic_case_id' => $case->id,
                'reference' => 'FEP-'.strtoupper(Str::random(8)),
                'manifest_hash' => $hash,
                'manifest' => $manifest,
                'event_count' => count($entries),
                'status' => 'sealed',
                'created_by' => $actor->id,
                'sealed_at' => now(),
            ]);

            app(AuditEventIngestionService::class)->ingest([
                'tenant_id' => $case->tenant_id,
                'event_key' => 'forensic.evidence.sealed',
                'actor_id' => $actor->id,
                'actor_type' => 'human',
                'outcome' => 'success',
                'source_module' => 'platform-audit',
                'subject_type' => ForensicEvidencePackage::class,
                'subject_id' => $pkg->id,
                'new_values' => [
                    'reference' => $pkg->reference,
                    'manifest_hash' => $hash,
                    'event_count' => $pkg->event_count,
                ],
                'idempotency_key' => 'forensic-pkg:'.$pkg->uuid,
            ]);

            return $pkg;
        });
    }

    public function verifyPackage(ForensicEvidencePackage $pkg): array
    {
        $canonical = json_encode($pkg->manifest, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $recomputed = hash('sha256', (string) $canonical);
        $valid = hash_equals((string) $pkg->manifest_hash, $recomputed);

        return [
            'valid' => $valid,
            'stored_hash' => $pkg->manifest_hash,
            'recomputed_hash' => $recomputed,
            'event_count' => $pkg->event_count,
        ];
    }

    public function transferCustody(ForensicCase $case, User $actor, int $newHolderId, ?string $notes = null): ForensicCase
    {
        $prev = $case->custody_holder_id;
        $case->update([
            'custody_holder_id' => $newHolderId,
            'custody_notes' => trim(($case->custody_notes ?? '')."\n".now()->toIso8601String()
                ." custody {$prev} → {$newHolderId} by {$actor->id}: ".($notes ?? '')),
        ]);

        return $case->fresh();
    }
}
