<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void {
        $user = config('database.connections.pgsql.username');
        foreach (['performance_trackers', 'hr_personal_files', 'hr_file_documents', 'hr_file_timeline_events'] as $tbl) {
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {$tbl} TO \"{$user}\"");
        }
    }
    public function down(): void {}
};
