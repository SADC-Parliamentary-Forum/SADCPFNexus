<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Grant the non-superuser application DB role (app_user) access to the new
 * M&E tables and their sequences, matching the RLS/grant pattern used by other
 * modules (see *_grant_app_user_* migrations).
 */
return new class extends Migration
{
    private array $tables = [
        'me_thematic_areas',
        'strategic_plans',
        'strategic_goals',
        'strategic_objectives',
        'strategic_outcomes',
        'strategic_outputs',
        'results_frameworks',
        'indicators',
        'me_activity_reports',
        'me_activity_report_indicator',
        'me_evidence',
        'me_review_history',
    ];

    public function up(): void
    {
        // Skip on non-PostgreSQL connections (e.g. local sqlite); app_user is a
        // PostgreSQL role only.
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        // Only run if the app_user role exists.
        $roleExists = DB::selectOne("SELECT 1 FROM pg_roles WHERE rolname = 'app_user'");
        if (! $roleExists) {
            return;
        }

        foreach ($this->tables as $table) {
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO app_user");
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
        }
    }

    public function down(): void {}
};
