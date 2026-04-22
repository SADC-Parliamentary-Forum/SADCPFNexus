<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON payslip_line_configs TO app_user');
        DB::statement('GRANT USAGE, SELECT ON SEQUENCE payslip_line_configs_id_seq TO app_user');
    }

    public function down(): void
    {
        DB::statement('REVOKE ALL ON payslip_line_configs FROM app_user');
    }
};
