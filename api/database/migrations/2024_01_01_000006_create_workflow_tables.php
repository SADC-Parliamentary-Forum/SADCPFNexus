<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workflow_definitions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('module');
            $table->json('steps'); // array of step definitions
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('published_by')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->unsignedBigInteger('countersigned_by')->nullable();
            $table->timestamp('countersigned_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('workflow_instances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workflow_definition_id')->constrained()->cascadeOnDelete();
            $table->string('workflowable_type');
            $table->unsignedBigInteger('workflowable_id');
            $table->foreignId('initiated_by')->constrained('users')->cascadeOnDelete();
            $table->enum('status', ['pending', 'in_progress', 'approved', 'rejected', 'cancelled'])->default('pending');
            $table->unsignedTinyInteger('current_step')->default(1);
            $table->timestamps();

            $table->index(['workflowable_type', 'workflowable_id']);
        });

        Schema::create('approval_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workflow_instance_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('step_number');
            $table->string('step_name');
            $table->foreignId('approver_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('approver_role')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected', 'delegated', 'skipped'])->default('pending');
            $table->text('comments')->nullable();
            $table->string('approval_token', 64)->nullable()->unique();
            $table->timestamp('token_expires_at')->nullable();
            $table->timestamp('acted_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approval_steps');
        Schema::dropIfExists('workflow_instances');
        Schema::dropIfExists('workflow_definitions');
    }
};
