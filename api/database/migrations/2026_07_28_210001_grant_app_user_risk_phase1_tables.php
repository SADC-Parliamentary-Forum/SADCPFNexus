<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $tables = [
            'risk_assessments',
            'risk_controls',
            'risk_control_risk',
            'risk_appetite_policies',
            'risk_acceptances',
            'risk_incidents',
        ];

        $user = config('database.connections.pgsql.app_user', 'sadcpf_app');

        foreach ($tables as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            try {
                DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO {$user}");
                DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO {$user}");
            } catch (\Throwable) {
                // Local sqlite / non-pgsql test envs ignore grants.
            }
        }
    }

    public function down(): void
    {
        // Grants are not revoked on down.
    }
};
