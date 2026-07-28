<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Grant app DB role access to Consumables Phase 1 tables (PostgreSQL only).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $user = config('database.connections.pgsql.username');
        if (! $user || $user === 'postgres') {
            return;
        }

        foreach (['stock_units', 'stock_locations', 'stocktakes', 'stocktake_lines'] as $table) {
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO \"{$user}\"");
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO \"{$user}\"");
        }
    }

    public function down(): void {}
};
