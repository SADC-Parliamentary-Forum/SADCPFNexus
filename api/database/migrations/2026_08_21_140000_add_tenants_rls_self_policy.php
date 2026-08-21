<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * tenants has RLS enabled (2024_01_01_000008) but never received a policy.
     * PostgreSQL then denies all rows to app_user, so Tenant::findOrFail 404s
     * on procurement settings / policy-profiles while other tables work.
     */
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql' || ! Schema::hasTable('tenants')) {
            return;
        }

        try {
            DB::statement('ALTER TABLE tenants ENABLE ROW LEVEL SECURITY');
            DB::statement('DROP POLICY IF EXISTS tenant_isolation ON tenants');
            DB::statement('DROP POLICY IF EXISTS tenant_self ON tenants');
            DB::statement(<<<'SQL'
                CREATE POLICY tenant_self ON tenants
                FOR ALL
                TO app_user
                USING (id = NULLIF(current_setting('app.tenant_id', true), '')::bigint)
                WITH CHECK (id = NULLIF(current_setting('app.tenant_id', true), '')::bigint)
            SQL);
        } catch (\Throwable) {
            // Local PHPUnit roles may not include app_user.
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql' || ! Schema::hasTable('tenants')) {
            return;
        }

        try {
            DB::statement('DROP POLICY IF EXISTS tenant_self ON tenants');
        } catch (\Throwable) {
            // Local PHPUnit roles may not include app_user.
        }
    }
};
