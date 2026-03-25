<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $tables = ['hr_job_families', 'hr_grade_bands', 'hr_salary_scales'];
        foreach ($tables as $tbl) {
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {$tbl} TO app_user");
        }
    }

    public function down(): void {}
};
