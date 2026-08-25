<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        // Docker init.sql creates this role; GitHub Actions Postgres does not.
        DB::statement(<<<'SQL'
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
                    CREATE ROLE app_user NOLOGIN;
                END IF;
            END
            $$;
        SQL);
        $database = str_replace('"', '""', (string) DB::getDatabaseName());
        DB::statement("GRANT CONNECT ON DATABASE \"{$database}\" TO app_user");
        DB::statement('GRANT USAGE ON SCHEMA public TO app_user');

        // Grant app_user access to tables
        $tables = [
            'tenants', 'departments', 'users', 'audit_logs', 'attachments',
            'workflow_definitions', 'workflow_instances', 'approval_steps',
            'form_templates', 'form_instances',
        ];

        foreach ($tables as $table) {
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO app_user");
            DB::statement("ALTER TABLE {$table} ENABLE ROW LEVEL SECURITY");
        }

        // Grant sequence usage
        DB::statement("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user");

        // Tenant isolation policy on users
        DB::statement("
            CREATE POLICY tenant_isolation ON users
            USING (tenant_id = current_setting('app.tenant_id', true)::bigint)
        ");

        DB::statement("
            CREATE POLICY tenant_isolation ON departments
            USING (tenant_id = current_setting('app.tenant_id', true)::bigint)
        ");

        DB::statement("
            CREATE POLICY tenant_isolation ON attachments
            USING (tenant_id = current_setting('app.tenant_id', true)::bigint)
        ");

        DB::statement("
            CREATE POLICY tenant_isolation ON workflow_definitions
            USING (tenant_id = current_setting('app.tenant_id', true)::bigint)
        ");

        DB::statement("
            CREATE POLICY tenant_isolation ON workflow_instances
            USING (tenant_id = current_setting('app.tenant_id', true)::bigint)
        ");

        DB::statement("
            CREATE POLICY tenant_isolation ON approval_steps
            USING (tenant_id = current_setting('app.tenant_id', true)::bigint)
        ");

        DB::statement("
            CREATE POLICY tenant_isolation ON form_templates
            USING (tenant_id = current_setting('app.tenant_id', true)::bigint)
        ");

        DB::statement("
            CREATE POLICY tenant_isolation ON form_instances
            USING (tenant_id = current_setting('app.tenant_id', true)::bigint)
        ");

        DB::statement("
            CREATE POLICY tenant_isolation ON audit_logs
            USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::bigint)
        ");
    }

    public function down(): void
    {
        $tables = [
            'tenants', 'departments', 'users', 'audit_logs', 'attachments',
            'workflow_definitions', 'workflow_instances', 'approval_steps',
            'form_templates', 'form_instances',
        ];

        foreach ($tables as $table) {
            DB::statement("DROP POLICY IF EXISTS tenant_isolation ON {$table}");
            DB::statement("ALTER TABLE {$table} DISABLE ROW LEVEL SECURITY");
        }
    }
};
