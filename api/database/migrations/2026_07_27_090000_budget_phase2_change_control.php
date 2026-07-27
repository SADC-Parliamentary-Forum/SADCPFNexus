<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('budget_control_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('budget_control_settings', 'revision_finance_ceiling_pct')) {
                $table->decimal('revision_finance_ceiling_pct', 5, 2)->default(10)->after('critical_utilisation_pct');
            }
        });

        Schema::table('budget_lines', function (Blueprint $table) {
            if (! Schema::hasColumn('budget_lines', 'is_contingency')) {
                $table->boolean('is_contingency')->default(false)->after('is_active');
            }
        });

        Schema::create('budget_change_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('financial_year_id')->nullable()->constrained('financial_years')->nullOnDelete();
            $table->foreignId('budget_id')->constrained('budgets')->restrictOnDelete();
            $table->string('type', 40);
            $table->string('title');
            $table->string('status', 40)->default('draft');
            $table->text('justification')->nullable();
            $table->boolean('requires_sg')->default(false);
            $table->foreignId('prepared_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->foreignId('finance_decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('finance_decided_at')->nullable();
            $table->text('finance_comments')->nullable();
            $table->foreignId('sg_decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('sg_decided_at')->nullable();
            $table->text('sg_comments')->nullable();
            $table->foreignId('applied_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('applied_at')->nullable();
            $table->text('rejected_reason')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->index(['budget_id', 'type']);
        });

        Schema::create('budget_change_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('budget_change_request_id')->constrained('budget_change_requests')->cascadeOnDelete();
            $table->foreignId('source_budget_line_id')->nullable()->constrained('budget_lines')->nullOnDelete();
            $table->foreignId('target_budget_line_id')->nullable()->constrained('budget_lines')->nullOnDelete();
            $table->string('new_line_code', 60)->nullable();
            $table->string('new_line_name')->nullable();
            $table->string('new_line_category', 80)->nullable();
            $table->foreignId('new_line_funding_source_id')->nullable()->constrained('funding_sources')->nullOnDelete();
            $table->decimal('amount', 15, 2);
            $table->boolean('is_decrease')->default(false);
            $table->text('notes')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['budget_change_request_id', 'sort_order']);
        });

        try {
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON budget_change_requests TO app_user');
            DB::statement('GRANT USAGE, SELECT ON SEQUENCE budget_change_requests_id_seq TO app_user');
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON budget_change_items TO app_user');
            DB::statement('GRANT USAGE, SELECT ON SEQUENCE budget_change_items_id_seq TO app_user');
        } catch (\Throwable) {
            // app_user may not exist locally/tests
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_change_items');
        Schema::dropIfExists('budget_change_requests');

        Schema::table('budget_lines', function (Blueprint $table) {
            if (Schema::hasColumn('budget_lines', 'is_contingency')) {
                $table->dropColumn('is_contingency');
            }
        });

        Schema::table('budget_control_settings', function (Blueprint $table) {
            if (Schema::hasColumn('budget_control_settings', 'revision_finance_ceiling_pct')) {
                $table->dropColumn('revision_finance_ceiling_pct');
            }
        });
    }
};
