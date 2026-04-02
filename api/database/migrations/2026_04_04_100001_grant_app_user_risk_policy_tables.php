<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON policies TO app_user");
        DB::statement("GRANT USAGE, SELECT ON SEQUENCE policies_id_seq TO app_user");

        DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON risk_policy TO app_user");
        DB::statement("GRANT USAGE, SELECT ON SEQUENCE risk_policy_id_seq TO app_user");
    }

    public function down(): void {}
};
