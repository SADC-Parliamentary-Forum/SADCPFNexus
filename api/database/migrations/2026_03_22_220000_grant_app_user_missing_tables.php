<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $tables = [
            'activity_log',
            'asset_categories',
            'hr_personal_files',
            'hr_file_documents',
            'hr_file_timeline_events',
            'performance_trackers',
        ];

        foreach ($tables as $table) {
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {$table} TO app_user");
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
        }
    }

    public function down(): void {}
};
