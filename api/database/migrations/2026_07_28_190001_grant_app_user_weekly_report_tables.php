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

        $user = config('database.connections.pgsql.app_user', env('DB_APP_USERNAME'));
        if (! $user) {
            return;
        }

        $tables = [
            'weekly_reporting_periods',
            'weekly_reports',
            'weekly_report_items',
            'weekly_report_blockers',
            'weekly_report_decision_requests',
            'weekly_report_priorities',
            'weekly_report_support_requests',
            'weekly_report_risks',
            'weekly_report_reviews',
            'weekly_report_versions',
            'weekly_report_consolidation_links',
            'weekly_report_exemptions',
            'weekly_report_deadline_changes',
            'weekly_report_documents',
            'weekly_report_suggestion_decisions',
            'weekly_report_audit_events',
        ];

        foreach ($tables as $table) {
            if (Schema::hasTable($table)) {
                DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {$table} TO \"{$user}\"");
            }
        }

        foreach ([
            'weekly_reporting_periods_id_seq',
            'weekly_reports_id_seq',
            'weekly_report_items_id_seq',
            'weekly_report_blockers_id_seq',
            'weekly_report_decision_requests_id_seq',
            'weekly_report_priorities_id_seq',
            'weekly_report_support_requests_id_seq',
            'weekly_report_risks_id_seq',
            'weekly_report_reviews_id_seq',
            'weekly_report_versions_id_seq',
            'weekly_report_consolidation_links_id_seq',
            'weekly_report_exemptions_id_seq',
            'weekly_report_deadline_changes_id_seq',
            'weekly_report_documents_id_seq',
            'weekly_report_suggestion_decisions_id_seq',
            'weekly_report_audit_events_id_seq',
        ] as $seq) {
            try {
                DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$seq} TO \"{$user}\"");
            } catch (\Throwable) {
                // sequence may not exist on all drivers/environments
            }
        }
    }

    public function down(): void
    {
        // no-op
    }
};
