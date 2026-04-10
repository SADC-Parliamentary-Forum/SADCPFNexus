<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $user = config('database.connections.pgsql.username');
        if ($user && $user !== 'postgres') {
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON asset_movements TO \"{$user}\"");
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE asset_movements_id_seq TO \"{$user}\"");
        }
    }

    public function down(): void {}
};
