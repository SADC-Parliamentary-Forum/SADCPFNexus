<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON hr_contract_types TO app_user');
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON hr_leave_profiles TO app_user');
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON hr_allowance_profiles TO app_user');
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON hr_appraisal_templates TO app_user');
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON hr_personnel_file_sections TO app_user');
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON hr_approval_matrix TO app_user');
        DB::statement('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user');
    }

    public function down(): void {}
};
