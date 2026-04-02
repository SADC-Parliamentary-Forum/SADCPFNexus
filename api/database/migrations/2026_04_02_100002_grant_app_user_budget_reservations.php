<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON budget_reservations TO app_user");
        DB::statement("GRANT USAGE, SELECT ON SEQUENCE budget_reservations_id_seq TO app_user");
    }

    public function down(): void {}
};
