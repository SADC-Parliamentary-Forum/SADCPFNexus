<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('me_activity_reports', function (Blueprint $table) {
            $table->text('non_pif_reason')->nullable()->after('programme_id');
        });

        // Drop NOT NULL on programme_id (Postgres-safe).
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE me_activity_reports ALTER COLUMN programme_id DROP NOT NULL');
        } else {
            Schema::table('me_activity_reports', function (Blueprint $table) {
                $table->unsignedBigInteger('programme_id')->nullable()->change();
            });
        }

        Schema::create('me_follow_up_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('me_activity_report_id')->constrained('me_activity_reports')->cascadeOnDelete();
            $table->string('action', 1000);
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->date('due_date')->nullable();
            $table->string('priority', 20)->default('normal'); // low|normal|high|urgent
            $table->string('status', 30)->default('open'); // open|in_progress|completed|cancelled
            $table->text('comments')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->index(['me_activity_report_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('me_follow_up_actions');

        Schema::table('me_activity_reports', function (Blueprint $table) {
            $table->dropColumn('non_pif_reason');
        });

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE me_activity_reports ALTER COLUMN programme_id SET NOT NULL');
        }
    }
};
