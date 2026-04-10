<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $user = config('database.connections.pgsql.username');
        if ($user && $user !== 'postgres') {
            foreach (['weekly_summary_runs', 'weekly_summary_reports', 'weekly_summary_preferences', 'weekly_summary_delivery_events'] as $table) {
                DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO \"{$user}\"");
            }
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE weekly_summary_runs_id_seq TO \"{$user}\"");
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE weekly_summary_reports_id_seq TO \"{$user}\"");
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE weekly_summary_delivery_events_id_seq TO \"{$user}\"");
        }
    }

    public function down(): void {}
};
