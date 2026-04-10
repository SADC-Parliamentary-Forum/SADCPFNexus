<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Batch run tracker — one row per scheduled weekly batch
        Schema::create('weekly_summary_runs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->date('period_start');
            $table->date('period_end');
            $table->timestamp('scheduled_for');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->string('status', 30)->default('pending'); // pending, running, completed, failed, partial
            $table->unsignedInteger('total_users')->default(0);
            $table->unsignedInteger('total_generated')->default(0);
            $table->unsignedInteger('total_sent')->default(0);
            $table->unsignedInteger('total_failed')->default(0);
            $table->timestamps();
        });

        // One report per user per run
        Schema::create('weekly_summary_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('run_id')->constrained('weekly_summary_runs')->cascadeOnDelete();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('scope_type', 20); // institution, department, personal
            $table->date('period_start');
            $table->date('period_end');
            $table->jsonb('payload');
            $table->string('payload_hash', 128);
            $table->string('template_version', 20)->default('1.0');
            $table->string('status', 20)->default('generated'); // generated, queued, sent, failed, skipped
            $table->timestamp('sent_at')->nullable();
            $table->text('failure_reason')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'period_start']);
        });

        // User opt-in/out preferences
        Schema::create('weekly_summary_preferences', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->primary();
            $table->boolean('enabled')->default(true);
            $table->string('detail_mode', 20)->default('standard'); // compact, standard, detailed
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        // Delivery audit trail
        Schema::create('weekly_summary_delivery_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_id')->constrained('weekly_summary_reports')->cascadeOnDelete();
            $table->string('event_type', 50); // queued, sent, failed, bounced, retried
            $table->jsonb('event_payload')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('weekly_summary_delivery_events');
        Schema::dropIfExists('weekly_summary_preferences');
        Schema::dropIfExists('weekly_summary_reports');
        Schema::dropIfExists('weekly_summary_runs');
    }
};
