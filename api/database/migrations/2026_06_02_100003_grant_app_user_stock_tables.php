<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Grant the non-superuser application DB role access to the stock register tables,
 * mirroring the existing *_grant_app_user_* migrations so RLS-scoped queries work.
 * No-op on non-PostgreSQL drivers and when running as the superuser.
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

        foreach (['stock_categories', 'stock_items', 'stock_transactions'] as $table) {
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO \"{$user}\"");
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO \"{$user}\"");
        }
    }

    public function down(): void {}
};
