<?php

namespace App\Modules\Lifecycle\Services;

use App\Models\Lifecycle\LifecycleCase;
use App\Models\Lifecycle\LifecycleEvent;
use App\Models\User;

class LifecycleEventRecorder
{
    public function record(LifecycleCase $case, string $eventType, User $actor, array $payload = []): LifecycleEvent
    {
        return LifecycleEvent::create([
            'tenant_id' => $case->tenant_id,
            'case_id' => $case->id,
            'event_type' => $eventType,
            'actor_id' => $actor->id,
            'payload' => $payload,
            'created_at' => now(),
        ]);
    }
}
