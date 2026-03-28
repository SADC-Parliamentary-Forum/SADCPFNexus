<?php

namespace Database\Seeders;

use App\Models\Tenant;
use App\Models\WorkplanEventType;
use Illuminate\Database\Seeder;

/**
 * Seeds the 5 system workplan event types for every tenant.
 * Mirrors the logic in migration 2026_03_28_400001_seed_workplan_event_types.php
 * so that db:seed works in addition to migrate --seed.
 */
class WorkplanEventTypeSeeder extends Seeder
{
    private array $defaults = [
        ['slug' => 'meeting',   'name' => 'Meeting',   'icon' => 'groups',          'color' => 'primary', 'sort_order' => 1],
        ['slug' => 'travel',    'name' => 'Travel',    'icon' => 'flight_takeoff',  'color' => 'blue',    'sort_order' => 2],
        ['slug' => 'leave',     'name' => 'Leave',     'icon' => 'event_available', 'color' => 'green',   'sort_order' => 3],
        ['slug' => 'milestone', 'name' => 'Milestone', 'icon' => 'flag',            'color' => 'amber',   'sort_order' => 4],
        ['slug' => 'deadline',  'name' => 'Deadline',  'icon' => 'schedule',        'color' => 'red',     'sort_order' => 5],
    ];

    public function run(): void
    {
        $tenants = Tenant::all();

        foreach ($tenants as $tenant) {
            foreach ($this->defaults as $d) {
                WorkplanEventType::firstOrCreate(
                    ['tenant_id' => $tenant->id, 'slug' => $d['slug']],
                    [
                        'name'       => $d['name'],
                        'icon'       => $d['icon'],
                        'color'      => $d['color'],
                        'is_system'  => true,
                        'sort_order' => $d['sort_order'],
                    ]
                );
            }
        }

        $this->command->info('WorkplanEventTypes: seeded ' . count($this->defaults) . ' system types.');
    }
}
