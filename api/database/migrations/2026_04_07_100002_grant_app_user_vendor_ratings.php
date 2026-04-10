<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $db = config('database.connections.pgsql.database');
        $user = config('database.connections.pgsql.username');
        if ($user && $user !== 'postgres') {
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON vendor_ratings TO \"{$user}\"");
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE vendor_ratings_id_seq TO \"{$user}\"");
        }
    }

    public function down(): void {}
};
