<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Production seeder — structural/reference data only. No users.
 *
 * Run with: php artisan db:seed --class=ProductionSeeder
 * Then create the admin:  php artisan app:create-admin
 */
class ProductionSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            TenantSeeder::class,
            RolesAndPermissionsSeeder::class,
            DepartmentsSeeder::class,
            PortfolioSeeder::class,
            LookupsSeeder::class,
            AssetCategorySeeder::class,
            WorkflowSeeder::class,
            SupplierCategorySeeder::class,
        ]);

        $this->command->info('Structural data seeded. Run [php artisan app:create-admin] to create the System Admin user.');
    }
}
