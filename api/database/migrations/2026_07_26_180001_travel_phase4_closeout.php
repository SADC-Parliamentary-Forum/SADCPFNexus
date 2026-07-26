<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('travel_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('travel_requests', 'private_vehicle_reason')) {
                $table->text('private_vehicle_reason')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'private_vehicle_route')) {
                $table->string('private_vehicle_route')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'estimated_kilometres')) {
                $table->decimal('estimated_kilometres', 10, 2)->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'mileage_rate_per_km')) {
                $table->decimal('mileage_rate_per_km', 10, 4)->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'equivalent_airfare')) {
                $table->decimal('equivalent_airfare', 12, 2)->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'mileage_reimbursement_estimate')) {
                $table->decimal('mileage_reimbursement_estimate', 12, 2)->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'reimbursement_capped_amount')) {
                $table->decimal('reimbursement_capped_amount', 12, 2)->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'mileage_exceeds_airfare')) {
                $table->boolean('mileage_exceeds_airfare')->default(false);
            }
            if (! Schema::hasColumn('travel_requests', 'conflict_resolution_note')) {
                $table->text('conflict_resolution_note')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'conflicts_acknowledged_at')) {
                $table->timestamp('conflicts_acknowledged_at')->nullable();
            }
        });

        Schema::table('travel_funding_lines', function (Blueprint $table) {
            if (! Schema::hasColumn('travel_funding_lines', 'payor_sadc_pf')) {
                $table->boolean('payor_sadc_pf')->default(false);
            }
            if (! Schema::hasColumn('travel_funding_lines', 'payor_host')) {
                $table->boolean('payor_host')->default(false);
            }
            if (! Schema::hasColumn('travel_funding_lines', 'payor_donor')) {
                $table->boolean('payor_donor')->default(false);
            }
            if (! Schema::hasColumn('travel_funding_lines', 'payor_self')) {
                $table->boolean('payor_self')->default(false);
            }
            if (! Schema::hasColumn('travel_funding_lines', 'donor_amount')) {
                $table->decimal('donor_amount', 12, 2)->default(0);
            }
            if (! Schema::hasColumn('travel_funding_lines', 'self_amount')) {
                $table->decimal('self_amount', 12, 2)->default(0);
            }
        });

        if (! Schema::hasTable('travel_accommodations')) {
            Schema::create('travel_accommodations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('travel_request_id')->constrained('travel_requests')->cascadeOnDelete();
                $table->string('hotel_name');
                $table->string('country')->nullable();
                $table->string('city')->nullable();
                $table->date('check_in')->nullable();
                $table->date('check_out')->nullable();
                $table->string('room_type')->nullable();
                $table->decimal('rate', 12, 2)->nullable();
                $table->string('currency', 3)->nullable();
                $table->string('paid_by')->nullable(); // sadc_pf | host | donor | self
                $table->string('confirmation_number')->nullable();
                $table->date('cancellation_deadline')->nullable();
                $table->string('contact')->nullable();
                $table->foreignId('attachment_id')->nullable()->constrained('attachments')->nullOnDelete();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('travel_accommodations');

        Schema::table('travel_funding_lines', function (Blueprint $table) {
            foreach (['payor_sadc_pf', 'payor_host', 'payor_donor', 'payor_self', 'donor_amount', 'self_amount'] as $col) {
                if (Schema::hasColumn('travel_funding_lines', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('travel_requests', function (Blueprint $table) {
            foreach ([
                'private_vehicle_reason', 'private_vehicle_route', 'estimated_kilometres',
                'mileage_rate_per_km', 'equivalent_airfare', 'mileage_reimbursement_estimate',
                'reimbursement_capped_amount', 'mileage_exceeds_airfare',
                'conflict_resolution_note', 'conflicts_acknowledged_at',
            ] as $col) {
                if (Schema::hasColumn('travel_requests', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
