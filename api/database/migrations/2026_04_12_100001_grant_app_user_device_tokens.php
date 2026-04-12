<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $db   = config('database.connections.pgsql.database');
        $user = config('database.connections.pgsql.username');

        DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON device_tokens TO \"{$user}\"");
        DB::statement("GRANT USAGE, SELECT ON SEQUENCE device_tokens_id_seq TO \"{$user}\"");
    }

    public function down(): void
    {
        $db   = config('database.connections.pgsql.database');
        $user = config('database.connections.pgsql.username');

        DB::statement("REVOKE ALL ON device_tokens FROM \"{$user}\"");
        DB::statement("REVOKE ALL ON SEQUENCE device_tokens_id_seq FROM \"{$user}\"");
    }
};
