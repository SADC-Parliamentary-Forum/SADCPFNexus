<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $tables = ['roles', 'permissions', 'model_has_roles', 'model_has_permissions', 'role_has_permissions'];
        foreach ($tables as $table) {
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO app_user");
        }
        // Sequences for auto-increment IDs (roles and permissions use bigIncrements)
        DB::statement("GRANT USAGE, SELECT ON SEQUENCE roles_id_seq TO app_user");
        DB::statement("GRANT USAGE, SELECT ON SEQUENCE permissions_id_seq TO app_user");
    }

    public function down(): void
    {
        $tables = ['roles', 'permissions', 'model_has_roles', 'model_has_permissions', 'role_has_permissions'];
        foreach ($tables as $table) {
            DB::statement("REVOKE SELECT, INSERT, UPDATE, DELETE ON {$table} FROM app_user");
        }
        DB::statement("REVOKE USAGE, SELECT ON SEQUENCE roles_id_seq FROM app_user");
        DB::statement("REVOKE USAGE, SELECT ON SEQUENCE permissions_id_seq FROM app_user");
    }
};
