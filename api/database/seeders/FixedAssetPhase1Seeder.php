<?php

namespace Database\Seeders;

use App\Models\AssetLocation;
use App\Models\Tenant;
use App\Modules\Assets\Services\AssetCapitalisationPolicyService;
use App\Modules\Assets\Services\AssetDepreciationService;
use Illuminate\Database\Seeder;

class FixedAssetPhase1Seeder extends Seeder
{
    public function run(): void
    {
        $policyService = app(AssetCapitalisationPolicyService::class);
        $deprService = app(AssetDepreciationService::class);

        Tenant::query()->each(function (Tenant $tenant) use ($policyService, $deprService) {
            $policyService->ensureDefault($tenant->id);
            $deprService->ensureDefaultPolicy($tenant->id);

            $defaults = [
                ['code' => 'HQ-STORE', 'name' => 'Headquarters Store', 'building' => 'HQ', 'location_type' => 'warehouse'],
                ['code' => 'HQ-ICT', 'name' => 'ICT Office', 'building' => 'HQ', 'room' => 'ICT', 'location_type' => 'office'],
                ['code' => 'HQ-ADMIN', 'name' => 'Administration', 'building' => 'HQ', 'location_type' => 'office'],
            ];
            foreach ($defaults as $loc) {
                AssetLocation::firstOrCreate(
                    ['tenant_id' => $tenant->id, 'code' => $loc['code']],
                    [
                        'name' => $loc['name'],
                        'building' => $loc['building'] ?? null,
                        'room' => $loc['room'] ?? null,
                        'location_type' => $loc['location_type'],
                        'is_active' => true,
                    ]
                );
            }
        });
    }
}
