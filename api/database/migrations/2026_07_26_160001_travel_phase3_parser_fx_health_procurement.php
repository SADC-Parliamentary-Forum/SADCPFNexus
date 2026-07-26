<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('travel_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('travel_requests', 'itinerary_version')) {
                $table->unsignedInteger('itinerary_version')->default(0)->after('visa_last_reminded_at');
            }
            if (! Schema::hasColumn('travel_requests', 'itinerary_raw_source')) {
                $table->text('itinerary_raw_source')->nullable()->after('itinerary_version');
            }
            if (! Schema::hasColumn('travel_requests', 'health_vaccination_required')) {
                $table->boolean('health_vaccination_required')->default(false);
            }
            if (! Schema::hasColumn('travel_requests', 'health_vaccination_status')) {
                $table->string('health_vaccination_status')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'health_prophylaxis_required')) {
                $table->boolean('health_prophylaxis_required')->default(false);
            }
            if (! Schema::hasColumn('travel_requests', 'health_prophylaxis_status')) {
                $table->string('health_prophylaxis_status')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'health_estimated_cost')) {
                $table->decimal('health_estimated_cost', 12, 2)->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'health_notes')) {
                $table->text('health_notes')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'health_cleared_at')) {
                $table->timestamp('health_cleared_at')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'procurement_request_id')) {
                $table->foreignId('procurement_request_id')->nullable()->constrained('procurement_requests')->nullOnDelete();
            }
            if (! Schema::hasColumn('travel_requests', 'procurement_link_reason')) {
                $table->text('procurement_link_reason')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'procurement_link_required')) {
                $table->boolean('procurement_link_required')->default(false);
            }
        });

        Schema::table('travel_itineraries', function (Blueprint $table) {
            if (! Schema::hasColumn('travel_itineraries', 'flight_number')) {
                $table->string('flight_number')->nullable();
            }
            if (! Schema::hasColumn('travel_itineraries', 'carrier')) {
                $table->string('carrier')->nullable();
            }
            if (! Schema::hasColumn('travel_itineraries', 'departure_at')) {
                $table->timestamp('departure_at')->nullable();
            }
            if (! Schema::hasColumn('travel_itineraries', 'arrival_at')) {
                $table->timestamp('arrival_at')->nullable();
            }
            if (! Schema::hasColumn('travel_itineraries', 'parse_source')) {
                $table->string('parse_source')->nullable();
            }
            if (! Schema::hasColumn('travel_itineraries', 'itinerary_version')) {
                $table->unsignedInteger('itinerary_version')->default(0);
            }
        });

        Schema::table('travel_dsa_lines', function (Blueprint $table) {
            if (! Schema::hasColumn('travel_dsa_lines', 'fx_from_currency')) {
                $table->string('fx_from_currency', 3)->nullable();
            }
            if (! Schema::hasColumn('travel_dsa_lines', 'fx_to_currency')) {
                $table->string('fx_to_currency', 3)->nullable();
            }
            if (! Schema::hasColumn('travel_dsa_lines', 'fx_rate')) {
                $table->decimal('fx_rate', 18, 8)->nullable();
            }
            if (! Schema::hasColumn('travel_dsa_lines', 'fx_as_of')) {
                $table->date('fx_as_of')->nullable();
            }
        });

        if (! Schema::hasTable('travel_fx_rates')) {
            Schema::create('travel_fx_rates', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->string('from_currency', 3);
                $table->string('to_currency', 3);
                $table->decimal('rate', 18, 8);
                $table->date('effective_date');
                $table->string('source')->default('manual'); // manual | http
                $table->text('notes')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->index(['tenant_id', 'from_currency', 'to_currency', 'effective_date']);
            });
        }

        foreach (['travel_fx_rates'] as $table) {
            try {
                DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO app_user");
                DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
            } catch (\Throwable) {
                // app_user may not exist in local/test DBs
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('travel_fx_rates');

        Schema::table('travel_dsa_lines', function (Blueprint $table) {
            foreach (['fx_from_currency', 'fx_to_currency', 'fx_rate', 'fx_as_of'] as $col) {
                if (Schema::hasColumn('travel_dsa_lines', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('travel_itineraries', function (Blueprint $table) {
            foreach (['flight_number', 'carrier', 'departure_at', 'arrival_at', 'parse_source', 'itinerary_version'] as $col) {
                if (Schema::hasColumn('travel_itineraries', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('travel_requests', function (Blueprint $table) {
            if (Schema::hasColumn('travel_requests', 'procurement_request_id')) {
                $table->dropConstrainedForeignId('procurement_request_id');
            }
            foreach ([
                'itinerary_version', 'itinerary_raw_source',
                'health_vaccination_required', 'health_vaccination_status',
                'health_prophylaxis_required', 'health_prophylaxis_status',
                'health_estimated_cost', 'health_notes', 'health_cleared_at',
                'procurement_link_reason', 'procurement_link_required',
            ] as $col) {
                if (Schema::hasColumn('travel_requests', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
