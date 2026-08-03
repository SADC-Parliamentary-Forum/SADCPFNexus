<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference', 80);
            $table->string('report_key', 120);
            $table->string('label', 180);
            $table->string('format', 20)->default('csv');
            $table->json('filters')->nullable();
            $table->json('recipients')->nullable();
            $table->string('frequency', 30);
            $table->string('timezone', 80)->default('Africa/Windhoek');
            $table->timestamp('next_run_at')->nullable();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 30)->default('requested');
            $table->timestamp('last_run_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'reference']);
            $table->index(['tenant_id', 'status', 'next_run_at']);
        });

        Schema::create('report_export_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('schedule_id')->nullable()->constrained('report_schedules')->nullOnDelete();
            $table->string('reference', 80);
            $table->string('run_key', 160)->nullable();
            $table->string('report_key', 120);
            $table->string('format', 20);
            $table->json('filters')->nullable();
            $table->unsignedInteger('rows_count')->nullable();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reason')->nullable();
            $table->string('status', 30)->default('requested');
            $table->string('file_hash', 128)->nullable();
            $table->text('file_path')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'reference']);
            $table->unique(['tenant_id', 'run_key']);
            $table->index(['tenant_id', 'report_key', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_export_events');
        Schema::dropIfExists('report_schedules');
    }
};
