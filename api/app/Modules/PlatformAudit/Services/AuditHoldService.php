<?php

namespace App\Modules\PlatformAudit\Services;

use App\Models\PlatformAudit\AuditEvent;
use App\Models\PlatformAudit\AuditEventHold;
use App\Models\User;
use Illuminate\Support\Str;

class AuditHoldService
{
    /**
     * @param  array{hold_type: string, scope_type: string, scope_value?: ?string, audit_event_id?: ?int, reason: string}  $data
     */
    public function place(int $tenantId, User $actor, array $data): AuditEventHold
    {
        $hold = AuditEventHold::query()->create([
            'tenant_id' => $tenantId,
            'uuid' => (string) Str::uuid(),
            'hold_type' => $data['hold_type'],
            'scope_type' => $data['scope_type'],
            'scope_value' => $data['scope_value'] ?? null,
            'audit_event_id' => $data['audit_event_id'] ?? null,
            'reason' => $data['reason'],
            'status' => 'active',
            'placed_by' => $actor->id,
            'placed_at' => now(),
        ]);

        app(AuditEventIngestionService::class)->ingest([
            'tenant_id' => $tenantId,
            'event_key' => 'retention.hold.placed',
            'actor_id' => $actor->id,
            'actor_type' => 'human',
            'outcome' => 'success',
            'source_module' => 'platform-audit',
            'subject_type' => AuditEventHold::class,
            'subject_id' => $hold->id,
            'new_values' => [
                'hold_type' => $hold->hold_type,
                'scope_type' => $hold->scope_type,
                'reason' => $hold->reason,
            ],
            'idempotency_key' => 'hold-place:'.$hold->uuid,
        ]);

        return $hold;
    }

    public function release(AuditEventHold $hold, User $actor): AuditEventHold
    {
        if ($hold->status !== 'active') {
            return $hold;
        }

        $hold->status = 'released';
        $hold->released_by = $actor->id;
        $hold->released_at = now();
        $hold->save();

        app(AuditEventIngestionService::class)->ingest([
            'tenant_id' => $hold->tenant_id,
            'event_key' => 'retention.hold.released',
            'actor_id' => $actor->id,
            'actor_type' => 'human',
            'outcome' => 'success',
            'source_module' => 'platform-audit',
            'subject_type' => AuditEventHold::class,
            'subject_id' => $hold->id,
            'idempotency_key' => 'hold-release:'.$hold->uuid,
        ]);

        return $hold->fresh();
    }

    public function isEventOnHold(AuditEvent $event): bool
    {
        return AuditEventHold::query()
            ->where('tenant_id', $event->tenant_id)
            ->where('status', 'active')
            ->where(function ($q) use ($event) {
                $q->where('audit_event_id', $event->id)
                    ->orWhere(function ($inner) use ($event) {
                        $inner->where('scope_type', 'tenant');
                    })
                    ->orWhere(function ($inner) use ($event) {
                        $inner->where('scope_type', 'category')->where('scope_value', $event->category);
                    })
                    ->orWhere(function ($inner) use ($event) {
                        $inner->where('scope_type', 'subject')
                            ->where('scope_value', ($event->subject_type ?? '').':'.($event->subject_id ?? ''));
                    });
            })
            ->exists();
    }
}
