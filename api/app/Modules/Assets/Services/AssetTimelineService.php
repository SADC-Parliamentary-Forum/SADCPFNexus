<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetTimelineEvent;
use App\Models\User;

class AssetTimelineService
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function record(Asset $asset, string $type, string $title, ?User $actor = null, array $payload = []): AssetTimelineEvent
    {
        return AssetTimelineEvent::create([
            'tenant_id' => $asset->tenant_id,
            'asset_id' => $asset->id,
            'event_type' => $type,
            'title' => $title,
            'payload' => $payload === [] ? null : $payload,
            'actor_id' => $actor?->id,
            'occurred_at' => now(),
        ]);
    }
}
