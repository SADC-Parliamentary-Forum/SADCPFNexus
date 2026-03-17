<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference_number')->unique();

            // Core fields
            $table->string('title');
            $table->text('description');
            $table->text('objective')->nullable();
            $table->text('expected_output')->nullable();
            $table->enum('type', ['individual', 'sector', 'collaborative'])->default('individual');
            $table->enum('priority', ['low', 'medium', 'high', 'critical'])->default('medium');
            $table->enum('status', [
                'draft', 'issued', 'awaiting_acceptance', 'accepted',
                'active', 'at_risk', 'blocked', 'delayed',
                'completed', 'closed', 'returned', 'cancelled',
            ])->default('draft');

            // Ownership
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();

            // Schedule
            $table->date('due_date');
            $table->date('start_date')->nullable();
            $table->enum('checkin_frequency', ['daily', 'weekly', 'biweekly', 'monthly'])->nullable();

            // Links
            $table->unsignedBigInteger('linked_programme_id')->nullable();
            $table->unsignedBigInteger('linked_event_id')->nullable();

            // Flags
            $table->boolean('is_confidential')->default(false);
            $table->unsignedTinyInteger('progress_percent')->default(0);

            // Acceptance workflow
            $table->enum('acceptance_decision', [
                'accepted', 'clarification_requested', 'deadline_proposed', 'rejected',
            ])->nullable();
            $table->text('acceptance_notes')->nullable();
            $table->date('proposed_deadline')->nullable();
            $table->timestamp('accepted_at')->nullable();

            // Blockers
            $table->enum('blocker_type', [
                'awaiting_approval', 'awaiting_funds', 'awaiting_information', 'external_dependency',
            ])->nullable();
            $table->text('blocker_details')->nullable();

            // Closure
            $table->text('closure_notes')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamp('issued_at')->nullable();
            $table->timestamp('closed_at')->nullable();

            // Performance link
            $table->boolean('has_performance_note')->default(false);
            $table->unsignedTinyInteger('completion_rating')->nullable(); // 1-5

            $table->softDeletes();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assignments');
    }
};
