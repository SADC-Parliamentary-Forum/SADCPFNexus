<?php

use App\Modules\Workplan\WorkplanMeetingTypeCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('meeting_types') || ! Schema::hasTable('tenants')) {
            return;
        }

        $now = now();
        $tenantIds = DB::table('tenants')->pluck('id');

        foreach ($tenantIds as $tenantId) {
            foreach (WorkplanMeetingTypeCatalog::definitions() as $type) {
                $exists = DB::table('meeting_types')
                    ->where('tenant_id', $tenantId)
                    ->where('name', $type['name'])
                    ->exists();
                if ($exists) {
                    continue;
                }

                DB::table('meeting_types')->insert([
                    'tenant_id' => $tenantId,
                    'name' => $type['name'],
                    'description' => $type['description'],
                    'sort_order' => $type['sort_order'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        // Keep meeting types that may already be attached to workplan events.
    }
};
