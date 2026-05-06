<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $appUser = env('DB_RLS_ROLE', 'app_user');
        DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE payslips TO \"{$appUser}\"");
        DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE salary_advance_requests TO \"{$appUser}\"");
    }

    public function down(): void {}
};
