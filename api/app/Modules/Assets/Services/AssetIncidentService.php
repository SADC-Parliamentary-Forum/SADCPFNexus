<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetIncident;
use App\Models\AuditLog;
use App\Models\User;
use App\Modules\Assets\Support\AssetAccess;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AssetIncidentService
{
    public function __construct(private readonly AssetTimelineService $timeline) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function reportLost(Asset $asset, User $actor, array $data): Asset
    {
        $this->assertCanReport($asset, $actor);

        return DB::transaction(function () use ($asset, $actor, $data) {
            AssetIncident::create([
                'tenant_id' => $asset->tenant_id,
                'asset_id' => $asset->id,
                'type' => 'lost',
                'status' => 'open',
                'date_noticed' => $data['date_noticed'] ?? now()->toDateString(),
                'last_seen_date' => $data['last_seen_date'] ?? null,
                'last_known_location' => $data['last_known_location'] ?? null,
                'custodian_id' => $asset->assigned_to,
                'circumstances' => $data['circumstances'] ?? null,
                'recorded_by' => $actor->id,
            ]);
            $asset->status = 'lost';
            $asset->save();
            $this->timeline->record($asset, 'ASSET_LOST', 'Asset reported lost', $actor, $data);
            AuditLog::record('assets.lost', [
                'auditable_type' => Asset::class,
                'auditable_id' => $asset->id,
                'tags' => 'assets',
            ]);

            return $asset->fresh();
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function reportStolen(Asset $asset, User $actor, array $data): Asset
    {
        $this->assertCanReport($asset, $actor);

        return DB::transaction(function () use ($asset, $actor, $data) {
            AssetIncident::create([
                'tenant_id' => $asset->tenant_id,
                'asset_id' => $asset->id,
                'type' => 'stolen',
                'status' => 'open',
                'date_noticed' => $data['date_noticed'] ?? now()->toDateString(),
                'circumstances' => $data['circumstances'] ?? null,
                'custodian_id' => $asset->assigned_to,
                'police_station' => $data['police_station'] ?? null,
                'police_case_number' => $data['police_case_number'] ?? null,
                'police_reported_on' => $data['police_reported_on'] ?? null,
                'insurer' => $data['insurer'] ?? null,
                'claim_reference' => $data['claim_reference'] ?? null,
                'recorded_by' => $actor->id,
            ]);
            $asset->status = 'stolen';
            $asset->save();
            $this->timeline->record($asset, 'ASSET_STOLEN', 'Asset reported stolen', $actor);
            AuditLog::record('assets.stolen', [
                'auditable_type' => Asset::class,
                'auditable_id' => $asset->id,
                'tags' => 'assets',
            ]);

            return $asset->fresh();
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function reportFound(Asset $asset, ?User $actor, array $data, bool $public = false): AssetIncident
    {
        if (! $public && $actor) {
            $this->assertCanReport($asset, $actor);
        }

        return DB::transaction(function () use ($asset, $actor, $data, $public) {
            $incident = AssetIncident::create([
                'tenant_id' => $asset->tenant_id,
                'asset_id' => $asset->id,
                'type' => 'found',
                'status' => $public ? 'open' : 'closed',
                'reporter_name' => $data['name'] ?? $data['reporter_name'] ?? $actor?->name,
                'reporter_phone' => $data['phone'] ?? $data['reporter_phone'] ?? null,
                'reporter_email' => $data['email'] ?? $data['reporter_email'] ?? null,
                'message' => $data['message'] ?? $data['notes'] ?? null,
                'found_location' => $data['location'] ?? $data['found_location'] ?? null,
                'public_report' => $public,
                'recorded_by' => $actor?->id,
            ]);

            if (! $public) {
                if (in_array($asset->status, ['lost', 'stolen', 'missing'], true)) {
                    $asset->status = 'active';
                    $asset->save();
                }
                AssetIncident::query()
                    ->where('asset_id', $asset->id)
                    ->whereIn('type', ['lost', 'stolen'])
                    ->where('status', 'open')
                    ->update(['status' => 'recovered']);
                $this->timeline->record($asset, 'ASSET_FOUND', 'Asset recovered', $actor);
                AuditLog::record('assets.found', [
                    'auditable_type' => Asset::class,
                    'auditable_id' => $asset->id,
                    'tags' => 'assets',
                ]);
            } else {
                $this->timeline->record($asset, 'ASSET_FOUND_PUBLIC', 'Public found-item report received');
            }

            return $incident->fresh();
        });
    }

    private function assertCanReport(Asset $asset, User $actor): void
    {
        if ((int) $asset->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }
        $isCustodian = $asset->assigned_to && (int) $asset->assigned_to === (int) $actor->id;
        if (! $isCustodian && ! AssetAccess::canManage($actor) && ! $actor->hasPermissionTo('assets.view')) {
            abort(403);
        }
    }
}
