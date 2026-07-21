<?php

namespace Database\Seeders;

use App\Models\MeThematicArea;
use App\Models\Tenant;
use Illuminate\Database\Seeder;

/**
 * Seeds the default M&E thematic areas (from config/lookups.php) into the
 * admin-configurable `me_thematic_areas` table for every tenant. Idempotent.
 *
 * Not auto-registered in DatabaseSeeder to avoid collisions with parallel work;
 * run explicitly with: php artisan db:seed --class=MandeThematicAreaSeeder
 */
class MandeThematicAreaSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = config('lookups.me_thematic_areas', []);

        Tenant::query()->each(function (Tenant $tenant) use ($defaults) {
            foreach ($defaults as $i => $area) {
                MeThematicArea::firstOrCreate(
                    ['tenant_id' => $tenant->id, 'code' => $area['code']],
                    [
                        'name'       => $area['name'],
                        'is_active'  => true,
                        'sort_order' => $i,
                    ]
                );
            }
        });
    }
}
