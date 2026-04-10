<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON ledger_verifications TO app_user');
        DB::statement('GRANT USAGE, SELECT ON SEQUENCE ledger_verifications_id_seq TO app_user');
    }

    public function down(): void
    {
        DB::statement('REVOKE ALL ON ledger_verifications FROM app_user');
        DB::statement('REVOKE ALL ON SEQUENCE ledger_verifications_id_seq FROM app_user');
    }
};
