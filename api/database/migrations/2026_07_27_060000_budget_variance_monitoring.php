<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('budget_control_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->decimal('significant_variance_pct', 5, 2)->default(20);
            $table->unsignedTinyInteger('warning_utilisation_pct')->default(80);
            $table->unsignedTinyInteger('critical_utilisation_pct')->default(100);
            $table->timestamps();

            $table->unique(['tenant_id']);
        });

        Schema::create('budget_variances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('budget_line_id')->constrained('budget_lines')->cascadeOnDelete();
            $table->foreignId('financial_year_id')->nullable()->constrained('financial_years')->nullOnDelete();
            $table->string('period_type', 20)->default('ytd'); // month|quarter|ytd|full_year
            $table->string('period_key', 20); // e.g. 2026-07, 2026-Q2, 2026/27
            $table->date('as_of_date');
            $table->decimal('approved_budget', 15, 2)->default(0);
            $table->decimal('actual_expenditure', 15, 2)->default(0);
            $table->decimal('open_commitments', 15, 2)->default(0);
            $table->decimal('available_budget', 15, 2)->default(0);
            $table->decimal('variance_amount', 15, 2)->default(0); // approved - actual
            $table->decimal('variance_pct', 8, 2)->nullable();
            $table->decimal('utilisation_pct', 8, 2)->nullable();
            $table->boolean('is_significant')->default(false);
            $table->string('status', 40)->default('open'); // open|explanation_required|explained|finance_reviewed|closed
            $table->timestamps();

            $table->unique(['budget_line_id', 'period_type', 'period_key'], 'budget_variances_line_period_unique');
            $table->index(['tenant_id', 'is_significant', 'status']);
        });

        Schema::create('budget_variance_explanations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('budget_variance_id')->constrained('budget_variances')->cascadeOnDelete();
            $table->foreignId('submitted_by')->constrained('users')->restrictOnDelete();
            $table->string('category', 60);
            $table->text('explanation');
            $table->text('remedial_action')->nullable();
            $table->string('status', 40)->default('submitted'); // submitted|accepted|returned
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('finance_comments')->nullable();
            $table->timestamps();

            $table->index(['budget_variance_id', 'status']);
        });

        try {
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON budget_control_settings TO app_user');
            DB::statement('GRANT USAGE, SELECT ON SEQUENCE budget_control_settings_id_seq TO app_user');
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON budget_variances TO app_user');
            DB::statement('GRANT USAGE, SELECT ON SEQUENCE budget_variances_id_seq TO app_user');
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON budget_variance_explanations TO app_user');
            DB::statement('GRANT USAGE, SELECT ON SEQUENCE budget_variance_explanations_id_seq TO app_user');
        } catch (\Throwable) {
            // app_user may not exist locally/tests
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_variance_explanations');
        Schema::dropIfExists('budget_variances');
        Schema::dropIfExists('budget_control_settings');
    }
};
