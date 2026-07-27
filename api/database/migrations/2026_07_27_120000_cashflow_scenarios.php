<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cashflow_scenarios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('financial_year_id')->constrained('financial_years')->restrictOnDelete();
            $table->string('name');
            $table->string('kind', 40)->default('base');
            $table->decimal('opening_balance', 15, 2)->default(0);
            $table->string('currency', 3)->default('NAD');
            $table->string('status', 40)->default('draft');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'financial_year_id', 'status']);
        });

        Schema::create('cashflow_scenario_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cashflow_scenario_id')->constrained('cashflow_scenarios')->cascadeOnDelete();
            $table->string('period', 7); // YYYY-MM
            $table->string('direction', 16); // inflow|outflow
            $table->decimal('amount', 15, 2);
            $table->string('label')->nullable();
            $table->string('category', 40)->default('manual');
            $table->foreignId('budget_reservation_id')->nullable()->constrained('budget_reservations')->nullOnDelete();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['cashflow_scenario_id', 'period']);
        });

        try {
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON cashflow_scenarios TO app_user');
            DB::statement('GRANT USAGE, SELECT ON SEQUENCE cashflow_scenarios_id_seq TO app_user');
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON cashflow_scenario_adjustments TO app_user');
            DB::statement('GRANT USAGE, SELECT ON SEQUENCE cashflow_scenario_adjustments_id_seq TO app_user');
        } catch (\Throwable) {
            // app_user may not exist locally/tests
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('cashflow_scenario_adjustments');
        Schema::dropIfExists('cashflow_scenarios');
    }
};
