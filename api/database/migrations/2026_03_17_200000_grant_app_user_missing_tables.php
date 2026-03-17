<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $tables = [
            'portfolios',
            'portfolio_user',
            'positions',
            'assignments',
            'assignment_updates',
            'hr_personal_files',
            'hr_file_documents',
            'hr_file_timeline_events',
            'notification_templates',
            'tenant_settings',
            'performance_trackers',
        ];

        foreach ($tables as $table) {
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {$table} TO app_user");
        }

        // Sequences for tables with auto-increment ids
        $sequences = [
            'portfolios_id_seq',
            'positions_id_seq',
            'assignments_id_seq',
            'assignment_updates_id_seq',
            'hr_personal_files_id_seq',
            'hr_file_documents_id_seq',
            'hr_file_timeline_events_id_seq',
            'notification_templates_id_seq',
            'tenant_settings_id_seq',
            'performance_trackers_id_seq',
        ];

        foreach ($sequences as $seq) {
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$seq} TO app_user");
        }
    }

    public function down(): void
    {
        // Grants are not reversed
    }
};
