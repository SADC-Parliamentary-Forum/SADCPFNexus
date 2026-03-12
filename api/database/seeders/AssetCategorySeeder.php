<?php

namespace Database\Seeders;

use App\Models\AssetCategory;
use App\Models\Tenant;
use Illuminate\Database\Seeder;

class AssetCategorySeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'sadcpf')->first();
        if (! $tenant) {
            return;
        }

        $defaults = [
            ['name' => 'IT', 'code' => 'it', 'sort_order' => 10],
            ['name' => 'Fleet', 'code' => 'fleet', 'sort_order' => 20],
            ['name' => 'Furniture', 'code' => 'furniture', 'sort_order' => 30],
            ['name' => 'Equipment', 'code' => 'equipment', 'sort_order' => 40],
        ];

        foreach ($defaults as $row) {
            AssetCategory::firstOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'code'      => $row['code'],
                ],
                [
                    'name'       => $row['name'],
                    'sort_order' => $row['sort_order'],
                ]
            );
        }
    }
}
