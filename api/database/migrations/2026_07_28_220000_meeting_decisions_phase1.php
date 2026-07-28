<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meeting_decisions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();

            $table->string('reference_number', 40);
            $table->string('decision_type', 40); // resolution|management_decision
            $table->string('title', 500);
            $table->text('body')->nullable();
            $table->string('status', 30)->default('draft');
            // draft|adopted|in_progress|implemented|closed|superseded

            $table->unsignedBigInteger('owner_id')->nullable();
            $table->foreign('owner_id')->references('id')->on('users')->nullOnDelete();
            $table->date('due_date')->nullable();

            $table->unsignedBigInteger('meeting_minutes_id')->nullable();
            $table->foreign('meeting_minutes_id')->references('id')->on('meeting_minutes')->nullOnDelete();
            $table->unsignedBigInteger('workplan_event_id')->nullable();

            $table->boolean('is_confidential')->default(false);

            $table->unsignedBigInteger('created_by');
            $table->foreign('created_by')->references('id')->on('users')->cascadeOnDelete();

            $table->unsignedBigInteger('adopted_by')->nullable();
            $table->foreign('adopted_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamp('adopted_at')->nullable();
            $table->text('adoption_notes')->nullable();

            $table->timestamp('implemented_at')->nullable();
            $table->unsignedBigInteger('closed_by')->nullable();
            $table->foreign('closed_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamp('closed_at')->nullable();
            $table->text('closure_notes')->nullable();

            $table->unsignedBigInteger('superseded_by_id')->nullable();
            $table->foreign('superseded_by_id')->references('id')->on('meeting_decisions')->nullOnDelete();

            // Optional inbound hooks (weekly summary / risk / etc.)
            $table->string('source_type', 40)->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('source_purpose', 60)->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'reference_number']);
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'decision_type']);
            $table->index(['tenant_id', 'owner_id']);
            $table->index(['tenant_id', 'is_confidential']);
            $table->index(['tenant_id', 'meeting_minutes_id']);
            $table->index(['tenant_id', 'source_type', 'source_id']);
        });

        Schema::create('meeting_decision_actions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->unsignedBigInteger('meeting_decision_id');
            $table->foreign('meeting_decision_id')->references('id')->on('meeting_decisions')->cascadeOnDelete();

            $table->unsignedBigInteger('created_by');
            $table->foreign('created_by')->references('id')->on('users')->cascadeOnDelete();
            $table->unsignedBigInteger('owner_id')->nullable();
            $table->foreign('owner_id')->references('id')->on('users')->nullOnDelete();

            $table->string('description', 1000);
            $table->text('notes')->nullable();
            $table->string('priority', 20)->default('medium'); // low|medium|high|critical
            $table->string('status', 30)->default('open'); // open|in_progress|completed|cancelled
            $table->date('due_date')->nullable();
            $table->unsignedBigInteger('assignment_id')->nullable();
            $table->timestamp('completed_at')->nullable();

            $table->timestamps();

            $table->index(['meeting_decision_id', 'status']);
            $table->index(['meeting_decision_id', 'priority', 'status']);
        });

        Schema::create('meeting_decision_history', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->unsignedBigInteger('meeting_decision_id');
            $table->foreign('meeting_decision_id')->references('id')->on('meeting_decisions')->cascadeOnDelete();
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->foreign('actor_id')->references('id')->on('users')->nullOnDelete();

            $table->string('change_type', 60);
            $table->string('from_status', 30)->nullable();
            $table->string('to_status', 30)->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('hash', 64);
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['meeting_decision_id', 'created_at']);
            $table->index(['tenant_id', 'change_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meeting_decision_history');
        Schema::dropIfExists('meeting_decision_actions');
        Schema::dropIfExists('meeting_decisions');
    }
};
