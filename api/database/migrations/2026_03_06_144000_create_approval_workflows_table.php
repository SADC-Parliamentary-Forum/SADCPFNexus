<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('approval_workflows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained();
            $table->string('name');
            $table->string('module_type')->unique(); // e.g., 'leave', 'travel'
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('approval_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workflow_id')->constrained('approval_workflows')->cascadeOnDelete();
            $table->integer('step_order');
            $table->string('approver_type'); // 'supervisor', 'up_the_chain', 'specific_role', 'specific_user'
            $table->foreignId('role_id')->nullable()->constrained(); // for 'specific_role'
            $table->foreignId('user_id')->nullable()->constrained(); // for 'specific_user'
            $table->timestamps();
        });

        Schema::create('approval_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained();
            $table->string('approvable_type'); // e.g., 'App\Models\LeaveRequest'
            $table->unsignedBigInteger('approvable_id');
            $table->foreignId('workflow_id')->constrained('approval_workflows');
            $table->integer('current_step_index')->default(0);
            $table->string('status')->default('pending'); // 'pending', 'approved', 'rejected'
            $table->timestamps();

            $table->index(['approvable_type', 'approvable_id']);
        });

        Schema::create('approval_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('approval_request_id')->constrained('approval_requests')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained(); // Who took the action
            $table->string('action'); // 'approve', 'reject'
            $table->text('comment')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approval_histories');
        Schema::dropIfExists('approval_requests');
        Schema::dropIfExists('approval_steps');
        Schema::dropIfExists('approval_workflows');
    }
};
