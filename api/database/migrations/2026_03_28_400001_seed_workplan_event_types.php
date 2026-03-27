<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** Seed the 5 default system event types for every existing tenant. */
    public function up(): void
    {
        $defaults = [
            ['slug' => 'meeting',   'name' => 'Meeting',   'icon' => 'groups',            'color' => 'primary', 'sort_order' => 1],
            ['slug' => 'travel',    'name' => 'Travel',    'icon' => 'flight_takeoff',    'color' => 'blue',    'sort_order' => 2],
            ['slug' => 'leave',     'name' => 'Leave',     'icon' => 'event_available',   'color' => 'green',   'sort_order' => 3],
            ['slug' => 'milestone', 'name' => 'Milestone', 'icon' => 'flag',              'color' => 'amber',   'sort_order' => 4],
            ['slug' => 'deadline',  'name' => 'Deadline',  'icon' => 'schedule',          'color' => 'red',     'sort_order' => 5],
        ];

        $tenantIds = DB::table('tenants')->pluck('id');
        $now = now();

        foreach ($tenantIds as $tenantId) {
            foreach ($defaults as $d) {
                DB::table('workplan_event_types')->insertOrIgnore([
                    'tenant_id'  => $tenantId,
                    'name'       => $d['name'],
                    'slug'       => $d['slug'],
                    'icon'       => $d['icon'],
                    'color'      => $d['color'],
                    'is_system'  => true,
                    'sort_order' => $d['sort_order'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        DB::table('workplan_event_types')->where('is_system', true)->delete();
    }
};
