<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON employee_salary_assignments TO app_user');
        DB::statement('GRANT USAGE, SELECT ON SEQUENCE employee_salary_assignments_id_seq TO app_user');
    }

    public function down(): void
    {
        DB::statement('REVOKE ALL ON employee_salary_assignments FROM app_user');
    }
};
