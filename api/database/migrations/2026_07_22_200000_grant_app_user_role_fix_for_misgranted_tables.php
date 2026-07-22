<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Fixes a widespread variant of the app_user grant bug: several
 * grant_app_user_* migrations granted to config('database.connections.pgsql.username')
 * (the connection's own login role, e.g. "sadcpf") instead of the literal
 * "app_user" role that SetRlsContext middleware actually switches into via
 * `SET ROLE app_user`. In every environment where DB_USERNAME !== 'app_user'
 * (which is every real environment — see .env.example / .env.production.example,
 * both use DB_USERNAME=sadcpf), those grants landed on the wrong role and
 * app_user never received them. This silently reproduces the same
 * SQLSTATE[42501] "permission denied" failure class fixed for
 * programme_documents / programme_arrival_departures, for every table below:
 *
 *  - 2026_04_09_200001_grant_app_user_asset_movements.php       (asset_movements)
 *  - 2026_04_12_100001_grant_app_user_device_tokens.php         (device_tokens)
 *  - 2026_06_02_100003_grant_app_user_stock_tables.php          (stock_categories, stock_items, stock_transactions)
 *  - 2026_04_09_100001_grant_app_user_user_sessions.php         (user_sessions)
 *  - 2026_04_07_100002_grant_app_user_vendor_ratings.php        (vendor_ratings)
 *  - 2026_04_07_200002_grant_app_user_vendor_performance_evaluations.php (vendor_performance_evaluations)
 *  - 2026_04_10_300001_grant_app_user_weekly_summary_tables.php (weekly_summary_* tables)
 *
 * workflow_delegations (2026_05_07_100004_create_workflow_delegations_table.php)
 * never had a grant_app_user_* migration at all — same root cause as
 * programme_documents, just never noticed because nothing exercised it yet.
 *
 * Separately, holiday_calendars / holiday_dates
 * (2026_04_08_100001_create_holiday_tables.php) were deliberately granted
 * SELECT-only to app_user, but Admin\HolidayCalendarController performs full
 * CRUD (store/update/destroy on both tables) over authenticated admin API
 * routes that run under SetRlsContext — so every create/update/delete of a
 * holiday calendar or date currently 500s in production. Upgrading these two
 * to the standard SELECT/INSERT/UPDATE/DELETE grant fixes that.
 *
 * This migration is purely additive (GRANT is idempotent) and does not touch
 * the pre-existing (harmless but ineffective) grants to the connection role.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $tablesWithStandardSequence = [
            'asset_movements',
            'device_tokens',
            'stock_categories',
            'stock_items',
            'stock_transactions',
            'user_sessions',
            'vendor_ratings',
            'vendor_performance_evaluations',
            'weekly_summary_runs',
            'weekly_summary_reports',
            'weekly_summary_delivery_events',
            'workflow_delegations',
        ];

        foreach ($tablesWithStandardSequence as $table) {
            $this->grantIfExists($table);
            $this->grantSequenceIfExists("{$table}_id_seq");
        }

        // No auto-increment sequence: user_id is the primary key (see
        // 2026_04_10_300000_create_weekly_summary_tables.php).
        $this->grantIfExists('weekly_summary_preferences');

        // Upgrade from the SELECT-only grant these two tables shipped with
        // (Admin\HolidayCalendarController performs full CRUD on both).
        foreach (['holiday_calendars', 'holiday_dates'] as $table) {
            $this->grantIfExists($table);
            $this->grantSequenceIfExists("{$table}_id_seq");
        }
    }

    public function down(): void
    {
        // Intentionally left blank — revoking grants breaks reads/writes for other rows.
    }

    private function grantIfExists(string $table): void
    {
        if (!$this->tableExists($table)) {
            return;
        }
        DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO app_user");
    }

    private function grantSequenceIfExists(string $sequence): void
    {
        $exists = DB::selectOne(
            "SELECT 1 FROM information_schema.sequences WHERE sequence_schema = 'public' AND sequence_name = ?",
            [$sequence]
        );
        if (!$exists) {
            return;
        }
        DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$sequence} TO app_user");
    }

    private function tableExists(string $table): bool
    {
        $result = DB::selectOne(
            "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?",
            [$table]
        );
        return (bool) $result;
    }
};
