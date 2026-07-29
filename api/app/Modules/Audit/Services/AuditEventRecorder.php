<?php

namespace App\Modules\Audit\Services;

use App\Models\AuditLog;
use App\Models\AuditModuleEvent;
use App\Models\User;

class AuditEventRecorder
{
    public function record(string $event, User $actor, ?string $type = null, ?int $id = null, array $payload = []): AuditModuleEvent
    {
        $last = AuditModuleEvent::query()
            ->where('tenant_id', $actor->tenant_id)
            ->latest('id')
            ->first();
        $previousHash = $last?->entry_hash ?? '0';

        $entry = [
            'tenant_id' => $actor->tenant_id,
            'event' => $event,
            'auditable_type' => $type,
            'auditable_id' => $id,
            'actor_id' => $actor->id,
            'payload' => $payload,
            'previous_hash' => $previousHash,
            'created_at' => now(),
        ];
        $entry['entry_hash'] = hash('sha256', json_encode($entry).$previousHash);

        $moduleEvent = AuditModuleEvent::create($entry);

        // Platform audit trail (separate; auditors cannot alter platform logs).
        AuditLog::record($event, [
            'auditable_type' => $type,
            'auditable_id' => $id,
            'new_values' => $payload,
            'tags' => ['audit_management'],
        ]);

        return $moduleEvent;
    }
}
