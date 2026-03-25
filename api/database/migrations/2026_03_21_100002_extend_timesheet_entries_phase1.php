<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Guard: columns were already added outside of Artisan (e.g. via a prior migration run)
        if (Schema::hasColumn('timesheet_entries', 'project_id')) {
            return;
        }

        Schema::table('timesheet_entries', function (Blueprint $table) {
            $table->foreignId('project_id')->nullable()->after('timesheet_id')
                  ->constrained('timesheet_projects')->nullOnDelete();
            $table->string('work_bucket', 50)->nullable()->after('project_id');
            $table->string('activity_type', 100)->nullable()->after('work_bucket');
            $table->foreignId('work_assignment_id')->nullable()->after('activity_type')
                  ->constrained('work_assignments')->nullOnDelete();
            $table->index(['timesheet_id', 'project_id']);
        });
    }

    public function down(): void
    {
        Schema::table('timesheet_entries', function (Blueprint $table) {
            $table->dropForeign(['project_id']);
            $table->dropForeign(['work_assignment_id']);
            $table->dropIndex(['timesheet_id', 'project_id']);
            $table->dropColumn(['project_id', 'work_bucket', 'activity_type', 'work_assignment_id']);
        });
    }
};
