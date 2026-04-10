<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $user = config('database.connections.pgsql.username');
        if ($user && $user !== 'postgres') {
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON vendor_performance_evaluations TO \"{$user}\"");
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE vendor_performance_evaluations_id_seq TO \"{$user}\"");
        }
    }

    public function down(): void {}
};
