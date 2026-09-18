<?php

namespace Database\Seeders;

use App\Models\AssetCategory;
use App\Models\Tenant;
use App\Modules\Assets\Support\AssetCategoryCatalog;
use Illuminate\Database\Seeder;

class AssetCategorySeeder extends Seeder
{
    public function run(): void
    {
        Tenant::query()->orderBy('id')->each(function (Tenant $tenant): void {
            foreach (AssetCategoryCatalog::items() as $item) {
                AssetCategory::query()->updateOrCreate(
                    [
                        'tenant_id' => $tenant->id,
                        'code' => $item['code'],
                    ],
                    [
                        'name' => $item['name'],
                        'sort_order' => $item['sort_order'],
                        'useful_life_years' => $item['useful_life_years'],
                    ]
                );
            }
        });
    }
}
