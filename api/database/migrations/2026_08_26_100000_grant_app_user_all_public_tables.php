<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Catch-up: grant DML on every public table to the *literal* PostgreSQL role
 * `app_user`.
 *
 * Runtime connections SET ROLE app_user (see SetRlsContext). Several earlier
 * grant_* migrations targeted config('database.connections.pgsql.app_user') /
 * DB_USERNAME (the login role, often `sadcpf`), so information_schema never
 * recorded grants for grantee `app_user` and AppUserGrantsTest failed.
 *
 * ALL TABLES is intentional: listing 100+ tables here would rot the same way
 * the per-table grant migrations already have. Exclusions match
 * Tests\Feature\Infrastructure\AppUserGrantsTest.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user');
        DB::statement('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user');
        DB::statement('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user');
        DB::statement('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user');

        foreach (['migrations', 'password_reset_tokens', 'sessions'] as $table) {
            if ($this->tableExists($table)) {
                DB::statement("REVOKE ALL ON TABLE {$table} FROM app_user");
            }
        }

        if ($this->tableExists('signed_action_tokens')) {
            DB::statement('REVOKE DELETE ON TABLE signed_action_tokens FROM app_user');
        }
    }

    private function tableExists(string $table): bool
    {
        $result = DB::selectOne(
            "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?",
            [$table]
        );

        return (bool) $result;
    }

    public function down(): void
    {
        // Privileges are additive catch-up; do not strip table-level grants
        // that earlier migrations (and this one) established for app_user.
    }
};
