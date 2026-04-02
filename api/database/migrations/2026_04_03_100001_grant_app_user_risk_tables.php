<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON risks TO app_user");
        DB::statement("GRANT USAGE, SELECT ON SEQUENCE risks_id_seq TO app_user");

        DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON risk_actions TO app_user");
        DB::statement("GRANT USAGE, SELECT ON SEQUENCE risk_actions_id_seq TO app_user");

        DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON risk_history TO app_user");
        DB::statement("GRANT USAGE, SELECT ON SEQUENCE risk_history_id_seq TO app_user");
    }

    public function down(): void {}
};
