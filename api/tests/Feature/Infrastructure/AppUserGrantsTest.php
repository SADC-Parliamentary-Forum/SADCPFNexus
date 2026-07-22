<?php

namespace Tests\Feature\Infrastructure;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Regression test for the app_user GRANT bug class that caused a production
 * 500 (SQLSTATE[42501] "permission denied for table programme_documents")
 * because programme_documents / programme_arrival_departures were created
 * without a matching grant_app_user_* migration.
 *
 * SetRlsContext middleware does `SET ROLE app_user` for every authenticated
 * request. If a table's owning role hasn't GRANTed app_user the privileges
 * it needs, any query against that table 500s at runtime — but nothing in
 * the test suite ever notices, because tests/TestCase.php unconditionally
 * does `$this->withoutMiddleware(SetRlsContext::class)`, so no test ever
 * actually runs as app_user.
 *
 * This test does NOT need to run as app_user or touch SetRlsContext at all.
 * It inspects the GRANT metadata directly via information_schema, which is
 * a static property of the schema — so it's simpler, faster, and catches
 * the bug for every current and future tenant-data table, not just the two
 * that broke in production.
 */
class AppUserGrantsTest extends TestCase
{
    /**
     * Tables intentionally excluded because they are Laravel/framework
     * bookkeeping tables that are never queried while the connection is
     * running as app_user (SetRlsContext only sets the role for the
     * lifetime of an authenticated API request, and resets it before any
     * of these tables would be touched):
     *
     *  - migrations: read by the migrator (as the superuser/owner) outside
     *    any HTTP request.
     *  - password_reset_tokens: written by password-reset endpoints which
     *    run before authentication, i.e. before SetRlsContext ever runs
     *    (no $request->user() yet, so the middleware is a no-op).
     *  - sessions: Sanctum's statefulApi() runs Laravel's session
     *    middleware *outside* (before) the SetRlsContext middleware
     *    registered on the api route group, and the session is persisted
     *    in that outer middleware's post-processing, which executes after
     *    SetRlsContext has already done RESET ROLE. So the sessions table
     *    is never written while the role is app_user.
     *  - cache_locks / cache / jobs / job_batches / failed_jobs /
     *    personal_access_tokens: these ARE granted to app_user already
     *    (see 2026_03_06_150000_grant_permissions_to_new_and_system_tables.php
     *    and 2026_03_02_300000_grant_app_user_remaining_tables.php) and are
     *    deliberately left OUT of this exclusion list so the test keeps
     *    covering them.
     */
    private const EXCLUDED_TABLES = [
        'migrations',
        'password_reset_tokens',
        'sessions',
    ];

    /**
     * Tables where a reduced privilege set is intentional (documented in
     * their grant_app_user_* migration), not a bug:
     *
     *  - signed_action_tokens: rows are never hard-deleted by the app (the
     *    token string itself is the access control secret, per
     *    2026_03_30_400001_grant_app_user_signed_action_tokens.php), so
     *    DELETE was deliberately omitted.
     */
    private const REDUCED_PRIVILEGE_TABLES = [
        'signed_action_tokens' => ['SELECT', 'INSERT', 'UPDATE'],
    ];

    private const REQUIRED_PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

    public function test_app_user_has_required_grants_on_every_tenant_data_table(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            $this->markTestSkipped('app_user RLS role grants only apply to the PostgreSQL driver.');
        }

        $tables = collect(DB::select(
            "SELECT table_name
               FROM information_schema.tables
              WHERE table_schema = 'public'
                AND table_type = 'BASE TABLE'
              ORDER BY table_name"
        ))->pluck('table_name')
            ->reject(fn (string $table) => in_array($table, self::EXCLUDED_TABLES, true))
            ->values();

        $this->assertNotEmpty(
            $tables,
            'Expected at least one base table in the public schema — did the test database fail to migrate?'
        );

        $grants = collect(DB::select(
            "SELECT table_name, privilege_type
               FROM information_schema.role_table_grants
              WHERE grantee = 'app_user'
                AND table_schema = 'public'"
        ))->groupBy('table_name')
            ->map(fn ($rows) => $rows->pluck('privilege_type')->all());

        $failures = [];

        foreach ($tables as $table) {
            $required = self::REDUCED_PRIVILEGE_TABLES[$table] ?? self::REQUIRED_PRIVILEGES;
            $actual = $grants->get($table, []);
            $missing = array_values(array_diff($required, $actual));

            if ($missing !== []) {
                $failures[] = sprintf('%s (missing: %s)', $table, implode(', ', $missing));
            }
        }

        $this->assertSame(
            [],
            $failures,
            "app_user is missing required GRANTs on the following table(s). Every table the app queries under \n".
            "SetRlsContext's `SET ROLE app_user` needs a matching grant_app_user_* migration, or authenticated \n".
            "requests will 500 with SQLSTATE[42501] \"permission denied\" (this is exactly what happened to \n".
            "programme_documents / programme_arrival_departures — see 2026_07_22_100000_grant_app_user_pif_documents_arrival_departures.php).\n".
            "Fix: add a migration granting `GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO app_user` (and the \n".
            "sequence, if any) for each table below:\n  - ".implode("\n  - ", $failures)
        );
    }
}
