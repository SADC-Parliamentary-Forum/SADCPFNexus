<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('travel_missions')) {
            Schema::create('travel_missions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->string('title');
                $table->foreignId('programme_id')->nullable()->constrained('programmes')->nullOnDelete();
                $table->string('destination_country')->nullable();
                $table->string('destination_city')->nullable();
                $table->date('start_date')->nullable();
                $table->date('end_date')->nullable();
                $table->text('notes')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
        }

        Schema::table('travel_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('travel_requests', 'programme_id')) {
                $table->foreignId('programme_id')->nullable()->after('workplan_event_id')->constrained('programmes')->nullOnDelete();
            }
            if (! Schema::hasColumn('travel_requests', 'mission_id')) {
                $table->foreignId('mission_id')->nullable()->after('programme_id')->constrained('travel_missions')->nullOnDelete();
            }
            if (! Schema::hasColumn('travel_requests', 'host_organization')) {
                $table->string('host_organization')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'budget_line_id')) {
                $table->unsignedBigInteger('budget_line_id')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'cabin_class')) {
                $table->string('cabin_class')->default('economy');
            }
            if (! Schema::hasColumn('travel_requests', 'route_is_most_economical')) {
                $table->boolean('route_is_most_economical')->default(true);
            }
            if (! Schema::hasColumn('travel_requests', 'route_justification')) {
                $table->text('route_justification')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'personal_incremental_cost')) {
                $table->decimal('personal_incremental_cost', 12, 2)->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'personal_cost_acknowledged_at')) {
                $table->timestamp('personal_cost_acknowledged_at')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'vehicle_type')) {
                $table->string('vehicle_type')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'driver_required')) {
                $table->boolean('driver_required')->default(false);
            }
            if (! Schema::hasColumn('travel_requests', 'driver_name')) {
                $table->string('driver_name')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'finance_status')) {
                $table->string('finance_status')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'director_finance_confirmed_at')) {
                $table->timestamp('director_finance_confirmed_at')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'director_finance_confirmed_by')) {
                $table->foreignId('director_finance_confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('travel_requests', 'director_finance_remarks')) {
                $table->text('director_finance_remarks')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'booking_committed_at')) {
                $table->timestamp('booking_committed_at')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'is_emergency')) {
                $table->boolean('is_emergency')->default(false);
            }
            if (! Schema::hasColumn('travel_requests', 'emergency_reason')) {
                $table->text('emergency_reason')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'emergency_authorised_by')) {
                $table->foreignId('emergency_authorised_by')->nullable()->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('travel_requests', 'returned_at')) {
                $table->timestamp('returned_at')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'retirement_status')) {
                $table->string('retirement_status')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'retirement_due_at')) {
                $table->date('retirement_due_at')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'official_personal_days')) {
                $table->json('official_personal_days')->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'finance_dsa_total')) {
                $table->decimal('finance_dsa_total', 12, 2)->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'meal_deduction_total')) {
                $table->decimal('meal_deduction_total', 12, 2)->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'terminal_comms_total')) {
                $table->decimal('terminal_comms_total', 12, 2)->nullable();
            }
            if (! Schema::hasColumn('travel_requests', 'amendment_of_id')) {
                $table->foreignId('amendment_of_id')->nullable()->constrained('travel_requests')->nullOnDelete();
            }
            if (! Schema::hasColumn('travel_requests', 'original_snapshot')) {
                $table->json('original_snapshot')->nullable();
            }
        });

        if (! Schema::hasTable('travel_funding_lines')) {
            Schema::create('travel_funding_lines', function (Blueprint $table) {
                $table->id();
                $table->foreignId('travel_request_id')->constrained()->cascadeOnDelete();
                $table->string('item');
                $table->decimal('forum_amount', 12, 2)->default(0);
                $table->decimal('host_amount', 12, 2)->default(0);
                $table->string('funding_agency')->nullable();
                $table->string('project')->nullable();
                $table->string('budget_line')->nullable();
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestamps();
            });
        }

        Schema::table('dsa_rates', function (Blueprint $table) {
            if (! Schema::hasColumn('dsa_rates', 'rate_type')) {
                $table->unsignedTinyInteger('rate_type')->default(1)->after('city');
            }
            if (! Schema::hasColumn('dsa_rates', 'accommodation_component')) {
                $table->decimal('accommodation_component', 10, 2)->nullable();
            }
            if (! Schema::hasColumn('dsa_rates', 'meal_component')) {
                $table->decimal('meal_component', 10, 2)->nullable();
            }
            if (! Schema::hasColumn('dsa_rates', 'incidentals_component')) {
                $table->decimal('incidentals_component', 10, 2)->nullable();
            }
            if (! Schema::hasColumn('dsa_rates', 'effective_from')) {
                $table->date('effective_from')->nullable();
            }
            if (! Schema::hasColumn('dsa_rates', 'effective_to')) {
                $table->date('effective_to')->nullable();
            }
            if (! Schema::hasColumn('dsa_rates', 'version')) {
                $table->unsignedInteger('version')->default(1);
            }
        });

        // Drop unique that blocks multiple rate types / versions for same city
        try {
            Schema::table('dsa_rates', function (Blueprint $table) {
                $table->dropUnique(['tenant_id', 'country', 'city']);
            });
        } catch (\Throwable) {
            // index may already be gone or named differently
        }

        if (! Schema::hasTable('travel_dsa_lines')) {
            Schema::create('travel_dsa_lines', function (Blueprint $table) {
                $table->id();
                $table->foreignId('travel_request_id')->constrained()->cascadeOnDelete();
                $table->date('date');
                $table->string('destination')->nullable();
                $table->unsignedTinyInteger('rate_type')->default(1);
                $table->decimal('daily_rate', 10, 2)->default(0);
                $table->decimal('meal_deduction', 10, 2)->default(0);
                $table->decimal('adjustments', 10, 2)->default(0);
                $table->decimal('daily_payable', 10, 2)->default(0);
                $table->boolean('is_personal')->default(false);
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('travel_toil_candidates')) {
            Schema::create('travel_toil_candidates', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('travel_request_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->date('candidate_date');
                $table->decimal('hours', 5, 1)->default(8.0);
                $table->string('reason')->nullable(); // weekend | public_holiday | both
                $table->string('status')->default('candidate');
                // candidate → ot_authorised → duty_confirmed → hr_validated → credited | rejected | lapsed
                $table->timestamp('ot_authorised_at')->nullable();
                $table->foreignId('ot_authorised_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('duty_confirmed_at')->nullable();
                $table->foreignId('duty_confirmed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('hr_validated_at')->nullable();
                $table->foreignId('hr_validated_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('credited_at')->nullable();
                $table->foreignId('overtime_accrual_id')->nullable()->constrained('overtime_accruals')->nullOnDelete();
                $table->date('expires_at')->nullable();
                $table->timestamp('sg_extended_at')->nullable();
                $table->foreignId('sg_extended_by')->nullable()->constrained('users')->nullOnDelete();
                $table->text('rejection_reason')->nullable();
                $table->timestamps();
                $table->unique(['travel_request_id', 'candidate_date']);
            });
        }

        if (! Schema::hasTable('travel_amendments')) {
            Schema::create('travel_amendments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('travel_request_id')->constrained()->cascadeOnDelete();
                $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
                $table->string('status')->default('draft'); // draft, submitted, approved, rejected
                $table->json('proposed_changes');
                $table->json('original_snapshot')->nullable();
                $table->text('reason')->nullable();
                $table->timestamps();
            });
        }

        Schema::table('travel_itineraries', function (Blueprint $table) {
            if (! Schema::hasColumn('travel_itineraries', 'day_type')) {
                $table->string('day_type')->default('official'); // official | personal_extension | personal_stopover
            }
        });

        if (Schema::hasTable('imprest_requests') && ! Schema::hasColumn('imprest_requests', 'travel_request_id')) {
            Schema::table('imprest_requests', function (Blueprint $table) {
                $table->foreignId('travel_request_id')->nullable()->after('requester_id')->constrained('travel_requests')->nullOnDelete();
            });
        }

        if (Schema::hasTable('overtime_accruals') && ! Schema::hasColumn('overtime_accruals', 'expires_at')) {
            Schema::table('overtime_accruals', function (Blueprint $table) {
                $table->date('expires_at')->nullable()->after('accrual_date');
            });
        }

        $this->grantTables([
            'travel_missions',
            'travel_funding_lines',
            'travel_dsa_lines',
            'travel_toil_candidates',
            'travel_amendments',
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('travel_amendments');
        Schema::dropIfExists('travel_toil_candidates');
        Schema::dropIfExists('travel_dsa_lines');
        Schema::dropIfExists('travel_funding_lines');

        if (Schema::hasTable('imprest_requests') && Schema::hasColumn('imprest_requests', 'travel_request_id')) {
            Schema::table('imprest_requests', function (Blueprint $table) {
                $table->dropConstrainedForeignId('travel_request_id');
            });
        }

        Schema::table('travel_requests', function (Blueprint $table) {
            foreach ([
                'programme_id', 'mission_id', 'host_organization', 'budget_line_id', 'cabin_class',
                'route_is_most_economical', 'route_justification', 'personal_incremental_cost',
                'personal_cost_acknowledged_at', 'vehicle_type', 'driver_required', 'driver_name',
                'finance_status', 'director_finance_confirmed_at', 'director_finance_confirmed_by',
                'director_finance_remarks', 'booking_committed_at', 'is_emergency', 'emergency_reason',
                'emergency_authorised_by', 'returned_at', 'retirement_status', 'retirement_due_at',
                'official_personal_days', 'finance_dsa_total', 'meal_deduction_total',
                'terminal_comms_total', 'amendment_of_id', 'original_snapshot',
            ] as $col) {
                if (Schema::hasColumn('travel_requests', $col)) {
                    try {
                        $table->dropColumn($col);
                    } catch (\Throwable) {
                    }
                }
            }
        });

        Schema::dropIfExists('travel_missions');
    }

    private function grantTables(array $tables): void
    {
        $user = config('database.connections.pgsql.username');
        if (! $user || config('database.default') !== 'pgsql') {
            return;
        }
        foreach ($tables as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            try {
                DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {$table} TO \"{$user}\"");
                DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO \"{$user}\"");
            } catch (\Throwable) {
            }
        }
    }
};
