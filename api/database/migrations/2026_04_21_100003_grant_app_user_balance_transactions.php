<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON balance_transactions TO app_user');
        DB::statement('GRANT USAGE, SELECT ON SEQUENCE balance_transactions_id_seq TO app_user');
    }

    public function down(): void
    {
        DB::statement('REVOKE ALL ON balance_transactions FROM app_user');
        DB::statement('REVOKE ALL ON SEQUENCE balance_transactions_id_seq FROM app_user');
    }
};
