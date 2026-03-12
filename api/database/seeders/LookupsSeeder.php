<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Lookups for the app are primarily driven by config (config/lookups.php)
 * and tenant-specific data (e.g. TimesheetProject seeded in DemoDataSeeder).
 * This seeder is a placeholder for any future DB-backed lookup tables.
 */
class LookupsSeeder extends Seeder
{
    public function run(): void
    {
        // No DB lookup tables to seed; travel_countries, leave_types, etc. come from config.
    }
}
