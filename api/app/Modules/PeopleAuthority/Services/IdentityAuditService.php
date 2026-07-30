<?php

namespace App\Modules\PeopleAuthority\Services;

use App\Models\PeopleAuthority\IdentityAuditEvent;
use App\Models\User;

class IdentityAuditService
{
    public function record(
        User $actor,
        string $eventType,
        ?int $personId = null,
        ?string $subjectType = null,
        ?int $subjectId = null,
        array $payload = [],
        string $privacyLevel = 'standard'
    ): IdentityAuditEvent {
        return IdentityAuditEvent::create([
            'tenant_id' => $actor->tenant_id,
            'event_type' => $eventType,
            'actor_user_id' => $actor->id,
            'person_id' => $personId,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'payload' => $payload,
            'privacy_level' => $privacyLevel,
        ]);
    }
}
