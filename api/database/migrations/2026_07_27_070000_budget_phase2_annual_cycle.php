<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('budget_cycles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('financial_year_id')->constrained('financial_years')->restrictOnDelete();
            $table->string('status', 40)->default('not_open');
            $table->foreignId('opened_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('opened_at')->nullable();
            $table->foreignId('locked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('locked_at')->nullable();
            $table->foreignId('sg_approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('sg_approved_at')->nullable();
            $table->decimal('approved_total', 15, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'financial_year_id']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('budget_guidelines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('budget_cycle_id')->constrained('budget_cycles')->cascadeOnDelete();
            $table->date('submission_opens_on')->nullable();
            $table->date('department_deadline')->nullable();
            $table->text('assumptions')->nullable();
            $table->decimal('inflation_rate', 8, 4)->nullable();
            $table->text('fx_assumptions')->nullable();
            $table->json('ceilings')->nullable();
            $table->string('guidance_document_path')->nullable();
            $table->foreignId('published_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->unique(['budget_cycle_id']);
        });

        Schema::create('budget_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('budget_cycle_id')->constrained('budget_cycles')->cascadeOnDelete();
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->foreignId('programme_id')->nullable()->constrained('programmes')->nullOnDelete();
            $table->string('type', 40)->default('department');
            $table->string('title');
            $table->string('status', 40)->default('draft');
            $table->foreignId('prepared_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->text('returned_reason')->nullable();
            $table->foreignId('approval_request_id')->nullable()->constrained('approval_requests')->nullOnDelete();
            $table->boolean('require_hod_approval')->default(false);
            $table->text('motivation')->nullable();
            $table->timestamps();

            $table->index(['budget_cycle_id', 'status']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('budget_submission_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('budget_submission_id')->constrained('budget_submissions')->cascadeOnDelete();
            $table->foreignId('funding_source_id')->nullable()->constrained('funding_sources')->nullOnDelete();
            $table->string('category', 80)->nullable();
            $table->string('code', 60)->nullable();
            $table->string('name');
            $table->text('description')->nullable();
            $table->decimal('quantity', 15, 4)->nullable();
            $table->decimal('unit_rate', 15, 4)->nullable();
            $table->decimal('calculated_amount', 15, 2)->nullable();
            $table->decimal('requested_amount', 15, 2);
            $table->decimal('prior_year_amount', 15, 2)->nullable();
            $table->text('justification')->nullable();
            $table->string('workplan_ref')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['budget_submission_id', 'sort_order']);
        });

        Schema::create('budget_cycle_approvals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('budget_cycle_id')->constrained('budget_cycles')->cascadeOnDelete();
            $table->string('stage', 40);
            $table->string('decision', 20);
            $table->foreignId('decided_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('decided_at');
            $table->text('comments')->nullable();
            $table->decimal('approved_total', 15, 2)->nullable();
            $table->timestamps();

            $table->index(['budget_cycle_id', 'stage']);
        });

        try {
            foreach ([
                'budget_cycles',
                'budget_guidelines',
                'budget_submissions',
                'budget_submission_items',
                'budget_cycle_approvals',
            ] as $table) {
                DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO app_user");
                DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
            }
        } catch (\Throwable) {
            // app_user may not exist locally/tests
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_cycle_approvals');
        Schema::dropIfExists('budget_submission_items');
        Schema::dropIfExists('budget_submissions');
        Schema::dropIfExists('budget_guidelines');
        Schema::dropIfExists('budget_cycles');
    }
};
