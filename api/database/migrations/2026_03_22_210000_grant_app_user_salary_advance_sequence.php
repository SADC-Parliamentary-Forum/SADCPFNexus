<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE salary_advance_requests TO app_user');
        DB::statement('GRANT USAGE, SELECT ON SEQUENCE salary_advance_requests_id_seq TO app_user');
    }

    public function down(): void
    {
        // Intentionally left blank — revoke only if needed manually
    }
};
