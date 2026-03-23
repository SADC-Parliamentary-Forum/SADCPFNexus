<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Full app seeding for dev/demo. Run with: php artisan migrate:fresh --seed
 * Order: tenant -> roles/permissions -> departments -> lookups -> users -> workflow -> demo data -> programmes -> workplan -> calendar.
 */
class DatabaseSeeder extends Seeder
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
            UsersSeeder::class,
            WorkflowSeeder::class,
            DemoDataSeeder::class,
            HrModulesSeeder::class,
            PositionsSeeder::class,
            AssignmentsSeeder::class,
            ProgrammeSeeder::class,
            ProgrammeAttachmentSeeder::class,
            WorkplanSeeder::class,
            CalendarSeeder::class,
            MissingModulesSeeder::class,
        ]);
    }
}
