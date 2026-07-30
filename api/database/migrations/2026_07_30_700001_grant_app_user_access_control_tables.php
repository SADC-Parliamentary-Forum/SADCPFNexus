<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $tables = [
            'access_role_catalogues',
            'access_role_versions',
            'access_role_assignments',
            'user_permission_grants',
            'user_permission_denials',
            'access_permission_requests',
            'access_governance_decisions',
            'access_permission_registry',
        ];

        foreach ($tables as $table) {
            $this->grantIfExists($table);
        }
    }

    public function down(): void
    {
        // Grants are additive; leave in place on rollback.
    }

    private function grantIfExists(string $table): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $exists = DB::selectOne('SELECT to_regclass(?) AS reg', ['public.'.$table]);
        if (! $exists || ! $exists->reg) {
            return;
        }

        DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO app_user");
        try {
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
        } catch (\Throwable) {
        }
    }
};
