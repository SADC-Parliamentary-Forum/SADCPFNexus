<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Grant app_user access to Spatie permission tables and all app tables
     * created in later migrations. Enable RLS + tenant policy where tenant_id exists.
     */
    public function up(): void
    {
        // Spatie permission tables (no tenant_id; grant only)
        $spatieTables = [
            'permissions',
            'roles',
            'model_has_permissions',
            'model_has_roles',
            'role_has_permissions',
        ];

        foreach ($spatieTables as $table) {
            $this->grantIfExists($table);
        }

        // App tables that have tenant_id: grant + RLS + policy
        $tenantTables = [
            'travel_requests',
            'dsa_rates',
            'leave_requests',
            'imprest_requests',
            'vendors',
            'procurement_requests',
            'timesheets',
            'salary_advance_requests',
            'payslips',
        ];

        foreach ($tenantTables as $table) {
            $this->grantIfExists($table);
            $this->enableRlsIfExists($table);
            $this->createTenantPolicyIfNotExists($table);
        }

        // App tables without tenant_id: grant only (access via parent or user)
        $otherTables = [
            'travel_itineraries',
            'leave_lil_linkings',
            'leave_balances',
            'procurement_items',
            'procurement_quotes',
            'timesheet_entries',
            'overtime_accruals',
            'personal_access_tokens',
        ];

        foreach ($otherTables as $table) {
            $this->grantIfExists($table);
        }
    }

    public function down(): void
    {
        $tenantTables = [
            'travel_requests', 'dsa_rates', 'leave_requests', 'imprest_requests',
            'vendors', 'procurement_requests', 'timesheets', 'salary_advance_requests', 'payslips',
        ];

        foreach ($tenantTables as $table) {
            $this->dropPolicyIfExists($table);
            $this->disableRlsIfExists($table);
        }
    }

    private function grantIfExists(string $table): void
    {
        if (!$this->tableExists($table)) {
            return;
        }
        DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO app_user");
    }

    private function tableExists(string $table): bool
    {
        $result = DB::selectOne(
            "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?",
            [$table]
        );
        return (bool) $result;
    }

    private function enableRlsIfExists(string $table): void
    {
        if (!$this->tableExists($table)) {
            return;
        }
        DB::statement("ALTER TABLE {$table} ENABLE ROW LEVEL SECURITY");
    }

    private function disableRlsIfExists(string $table): void
    {
        if (!$this->tableExists($table)) {
            return;
        }
        DB::statement("ALTER TABLE {$table} DISABLE ROW LEVEL SECURITY");
    }

    private function createTenantPolicyIfNotExists(string $table): void
    {
        if (!$this->tableExists($table)) {
            return;
        }
        $policyName = 'tenant_isolation';
        $exists = DB::selectOne(
            "SELECT 1 FROM pg_policies WHERE tablename = ? AND policyname = ?",
            [$table, $policyName]
        );
        if ($exists) {
            return;
        }
        DB::statement("
            CREATE POLICY {$policyName} ON {$table}
            USING (tenant_id = current_setting('app.tenant_id', true)::bigint)
        ");
    }

    private function dropPolicyIfExists(string $table): void
    {
        if (!$this->tableExists($table)) {
            return;
        }
        DB::statement("DROP POLICY IF EXISTS tenant_isolation ON {$table}");
    }
};
