<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('risks', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();

            $table->string('risk_code', 30)->unique();
            $table->string('title', 300);
            $table->text('description');
            $table->string('category', 50); // strategic|operational|financial|compliance|reputational|security|other

            $table->unsignedBigInteger('department_id')->nullable();
            $table->foreign('department_id')->references('id')->on('departments')->nullOnDelete();

            $table->unsignedBigInteger('risk_owner_id')->nullable();
            $table->foreign('risk_owner_id')->references('id')->on('users')->nullOnDelete();

            $table->unsignedBigInteger('action_owner_id')->nullable();
            $table->foreign('action_owner_id')->references('id')->on('users')->nullOnDelete();

            $table->unsignedBigInteger('submitted_by');
            $table->foreign('submitted_by')->references('id')->on('users')->cascadeOnDelete();

            $table->smallInteger('likelihood'); // 1–5
            $table->smallInteger('impact');     // 1–5
            $table->smallInteger('inherent_score'); // likelihood × impact

            $table->smallInteger('residual_likelihood')->nullable();
            $table->smallInteger('residual_impact')->nullable();
            $table->smallInteger('residual_score')->nullable();

            $table->string('control_effectiveness', 20)->default('none'); // none|partial|adequate|strong
            $table->string('risk_level', 20);  // low|medium|high|critical
            $table->string('status', 30)->default('draft');
            $table->string('escalation_level', 30)->default('none'); // none|departmental|directorate|sg|committee
            $table->string('review_frequency', 20)->nullable(); // monthly|quarterly|bi_annual|annual

            $table->date('next_review_date')->nullable();
            $table->text('review_notes')->nullable();
            $table->text('closure_evidence')->nullable();

            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->foreign('reviewed_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();

            $table->unsignedBigInteger('approved_by')->nullable();
            $table->foreign('approved_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();

            $table->unsignedBigInteger('closed_by')->nullable();
            $table->foreign('closed_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamp('closed_at')->nullable();

            $table->timestamp('submitted_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'risk_level']);
        });

        Schema::create('risk_actions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();

            $table->unsignedBigInteger('risk_id');
            $table->foreign('risk_id')->references('id')->on('risks')->cascadeOnDelete();

            $table->unsignedBigInteger('created_by');
            $table->foreign('created_by')->references('id')->on('users')->cascadeOnDelete();

            $table->unsignedBigInteger('owner_id')->nullable();
            $table->foreign('owner_id')->references('id')->on('users')->nullOnDelete();

            $table->text('description');
            $table->text('action_plan')->nullable();
            $table->string('treatment_type', 20)->default('mitigate'); // mitigate|accept|transfer|avoid
            $table->date('due_date')->nullable();
            $table->string('status', 20)->default('planned'); // planned|in_progress|completed|overdue
            $table->smallInteger('progress')->default(0); // 0–100
            $table->text('notes')->nullable();
            $table->timestamp('completed_at')->nullable();

            $table->timestamps();

            $table->index(['tenant_id', 'risk_id']);
        });

        Schema::create('risk_history', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();

            $table->unsignedBigInteger('risk_id');
            $table->foreign('risk_id')->references('id')->on('risks')->cascadeOnDelete();

            $table->unsignedBigInteger('actor_id');
            $table->foreign('actor_id')->references('id')->on('users')->cascadeOnDelete();

            $table->string('change_type', 50); // created|updated|submitted|reviewed|approved|escalated|closed|archived|action_added|action_completed
            $table->string('from_status', 30)->nullable();
            $table->string('to_status', 30)->nullable();
            $table->jsonb('old_values')->nullable();
            $table->jsonb('new_values')->nullable();
            $table->string('hash', 64)->nullable(); // SHA256 tamper evidence
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->useCurrent();
            // NO updated_at — immutable
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('risk_history');
        Schema::dropIfExists('risk_actions');
        Schema::dropIfExists('risks');
    }
};
