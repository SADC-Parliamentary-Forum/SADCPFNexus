<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void {
        $tables = ['work_assignments', 'work_assignment_updates', 'appraisal_cycles', 'appraisals', 'appraisal_kras', 'conduct_records'];
        foreach ($tables as $tbl) {
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {$tbl} TO app_user");
        }
    }
    public function down(): void {}
};
