<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('budget_reservations', function (Blueprint $table) {
            if (! Schema::hasColumn('budget_reservations', 'travel_request_id')) {
                $table->unsignedBigInteger('travel_request_id')->nullable()->after('procurement_request_id');
                $table->foreign('travel_request_id')->references('id')->on('travel_requests')->nullOnDelete();
                $table->index(['tenant_id', 'travel_request_id']);
            }
        });

        // Allow procurement_request_id to be null for travel reservations.
        if (Schema::hasColumn('budget_reservations', 'procurement_request_id')) {
            DB::statement('ALTER TABLE budget_reservations ALTER COLUMN procurement_request_id DROP NOT NULL');
        }

        Schema::table('travel_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('travel_requests', 'vehicle_asset_id')) {
                $table->unsignedBigInteger('vehicle_asset_id')->nullable();
                $table->timestamp('vehicle_assigned_at')->nullable();
                $table->unsignedBigInteger('vehicle_assigned_by')->nullable();
                $table->text('vehicle_conflict_note')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'sponsored_deduction_rate_id')) {
                $table->unsignedBigInteger('sponsored_deduction_rate_id')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'cancelled_at')) {
                $table->timestamp('cancelled_at')->nullable();
                $table->unsignedBigInteger('cancelled_by')->nullable();
                $table->text('cancellation_reason')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'meals_provided_by_host')) {
                $table->boolean('meals_provided_by_host')->default(false);
                $table->boolean('accommodation_provided_by_host')->default(false);
            }
        });

        if (! Schema::hasTable('travel_sponsored_deduction_rates')) {
            Schema::create('travel_sponsored_deduction_rates', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->string('name');
                $table->string('code', 64);
                $table->decimal('meal_deduction_percent', 5, 2)->default(0);
                $table->decimal('accommodation_deduction_percent', 5, 2)->default(0);
                $table->decimal('meal_deduction_fixed', 10, 2)->nullable();
                $table->decimal('accommodation_deduction_fixed', 10, 2)->nullable();
                $table->text('notes')->nullable();
                $table->boolean('is_active')->default(true);
                $table->date('effective_from')->nullable();
                $table->date('effective_to')->nullable();
                $table->timestamps();

                $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
                $table->unique(['tenant_id', 'code']);
            });
        }

        try {
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON travel_sponsored_deduction_rates TO app_user');
            DB::statement('GRANT USAGE, SELECT ON SEQUENCE travel_sponsored_deduction_rates_id_seq TO app_user');
        } catch (\Throwable) {
            // Role may not exist in local/test DBs.
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('travel_sponsored_deduction_rates');

        Schema::table('travel_requests', function (Blueprint $table) {
            foreach ([
                'vehicle_asset_id', 'vehicle_assigned_at', 'vehicle_assigned_by', 'vehicle_conflict_note',
                'sponsored_deduction_rate_id', 'cancelled_at', 'cancelled_by', 'cancellation_reason',
                'meals_provided_by_host', 'accommodation_provided_by_host',
            ] as $col) {
                if (Schema::hasColumn('travel_requests', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('budget_reservations', function (Blueprint $table) {
            if (Schema::hasColumn('budget_reservations', 'travel_request_id')) {
                $table->dropForeign(['travel_request_id']);
                $table->dropColumn('travel_request_id');
            }
        });
    }
};
