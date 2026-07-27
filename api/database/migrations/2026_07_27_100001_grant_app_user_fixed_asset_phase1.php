<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $tables = [
            'asset_capitalisation_policies',
            'asset_depreciation_rate_policies',
            'asset_locations',
            'asset_assignment_histories',
            'asset_location_histories',
            'asset_disposals',
            'asset_verification_campaigns',
            'asset_verification_results',
            'asset_maintenance_records',
            'asset_depreciation_runs',
            'asset_depreciation_run_lines',
        ];

        foreach ($tables as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO app_user");
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
        }
    }

    public function down(): void
    {
    }
};
