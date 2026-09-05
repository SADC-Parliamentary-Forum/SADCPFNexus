<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetVerificationCampaign;
use App\Models\AssetVerificationResult;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AssetVerificationService
{
    public function createCampaign(array $data, User $user): AssetVerificationCampaign
    {
        $campaign = AssetVerificationCampaign::create([
            'tenant_id' => $user->tenant_id,
            'name' => $data['name'],
            'status' => 'open',
            'starts_on' => $data['starts_on'],
            'ends_on' => $data['ends_on'] ?? null,
            'created_by' => $user->id,
        ]);

        AuditLog::record('assets.verification_campaign_created', [
            'auditable_type' => AssetVerificationCampaign::class,
            'auditable_id' => $campaign->id,
            'tags' => 'assets',
        ]);

        return $campaign;
    }

    public function recordResult(AssetVerificationCampaign $campaign, array $data, User $user): AssetVerificationResult
    {
        if ((int) $campaign->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        if ($campaign->status !== 'open') {
            throw ValidationException::withMessages(['status' => 'Campaign is closed.']);
        }

        $asset = Asset::where('tenant_id', $user->tenant_id)->findOrFail($data['asset_id']);

        return DB::transaction(function () use ($campaign, $data, $user, $asset) {
            $result = AssetVerificationResult::updateOrCreate(
                ['campaign_id' => $campaign->id, 'asset_id' => $asset->id],
                [
                    'result' => $data['result'],
                    'condition' => $data['condition'] ?? null,
                    'verified_by' => $user->id,
                    'verified_at' => now(),
                    'notes' => $data['notes'] ?? null,
                    'verification_method' => $data['verification_method'] ?? 'manual',
                    'gps_lat' => $data['gps_lat'] ?? null,
                    'gps_lng' => $data['gps_lng'] ?? null,
                    'device_id' => $data['device_id'] ?? null,
                    'photos' => $data['photos'] ?? null,
                    'mismatch_types' => $data['mismatch_types'] ?? null,
                ]
            );

            if ($data['result'] === 'verified') {
                $asset->last_verified_at = now();
                $asset->verification_status = 'verified';
                if (! empty($data['condition'])) {
                    $asset->condition = $data['condition'];
                }
                $asset->save();
            } elseif ($data['result'] === 'missing') {
                $asset->status = 'missing';
                $asset->verification_status = 'exception';
                $asset->save();
            } elseif ($data['result'] === 'damaged') {
                $asset->status = 'damaged';
                $asset->condition = 'damaged';
                $asset->verification_status = 'exception';
                $asset->save();
            } else {
                $asset->verification_status = 'exception';
                $asset->save();
            }

            AuditLog::record('assets.verification_recorded', [
                'auditable_type' => AssetVerificationResult::class,
                'auditable_id' => $result->id,
                'new_values' => ['result' => $data['result'], 'asset_id' => $asset->id],
                'tags' => 'assets',
            ]);

            return $result->fresh();
        });
    }

    public function closeCampaign(AssetVerificationCampaign $campaign, User $user): AssetVerificationCampaign
    {
        if ((int) $campaign->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        $campaign->status = 'closed';
        $campaign->save();

        return $campaign->fresh();
    }
}
