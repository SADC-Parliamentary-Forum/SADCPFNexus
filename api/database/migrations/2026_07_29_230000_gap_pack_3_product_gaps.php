<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('budget_fx_rates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('base_currency', 3)->default('NAD');
            $table->string('quote_currency', 3);
            $table->decimal('rate', 18, 8);
            $table->date('effective_date');
            $table->string('source', 32)->default('manual');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(
                ['tenant_id', 'base_currency', 'quote_currency', 'effective_date'],
                'budget_fx_rates_unique_pair_date'
            );
            $table->index(['tenant_id', 'effective_date']);
        });

        Schema::create('budget_contribution_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('donor_name');
            $table->string('source_type', 32)->default('donor');
            $table->string('currency', 3)->default('NAD');
            $table->decimal('amount', 18, 2);
            $table->string('frequency', 32); // monthly|quarterly|annual|one_off
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->date('next_due_date')->nullable();
            $table->string('status', 32)->default('active');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['tenant_id', 'status', 'next_due_date']);
        });

        Schema::create('assignment_dependencies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('assignment_id')->constrained('assignments')->cascadeOnDelete();
            $table->foreignId('depends_on_assignment_id')->constrained('assignments')->cascadeOnDelete();
            $table->string('dependency_type', 32)->default('blocks');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['assignment_id', 'depends_on_assignment_id'], 'assignment_deps_unique');
            $table->index(['tenant_id', 'depends_on_assignment_id']);
        });

        Schema::table('assignments', function (Blueprint $table) {
            if (! Schema::hasColumn('assignments', 'estimated_hours')) {
                $table->decimal('estimated_hours', 8, 2)->nullable()->after('due_date');
            }
        });

        Schema::create('payroll_import_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference')->nullable();
            $table->string('driver', 64)->default('null');
            $table->string('status', 32)->default('draft'); // draft|staged|exported
            $table->string('period', 32)->nullable();
            $table->unsignedInteger('line_count')->default(0);
            $table->json('source_meta')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('staged_at')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('payroll_import_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('batch_id')->constrained('payroll_import_batches')->cascadeOnDelete();
            $table->string('employee_number')->nullable();
            $table->string('period', 32)->nullable();
            $table->decimal('gross', 18, 2)->nullable();
            $table->decimal('deductions', 18, 2)->nullable();
            $table->decimal('net', 18, 2)->nullable();
            $table->string('external_ref')->nullable();
            $table->json('raw')->nullable();
            $table->timestamps();
            $table->index(['batch_id', 'employee_number']);
        });

        if (Schema::hasTable('correspondence_dispatches')) {
            Schema::table('correspondence_dispatches', function (Blueprint $table) {
                if (! Schema::hasColumn('correspondence_dispatches', 'courier_carrier')) {
                    $table->string('courier_carrier', 64)->nullable()->after('tracking_reference');
                }
                if (! Schema::hasColumn('correspondence_dispatches', 'tracking_number')) {
                    $table->string('tracking_number', 128)->nullable()->after('courier_carrier');
                }
                if (! Schema::hasColumn('correspondence_dispatches', 'tracking_status')) {
                    $table->string('tracking_status', 64)->nullable()->after('tracking_number');
                }
                if (! Schema::hasColumn('correspondence_dispatches', 'tracking_checked_at')) {
                    $table->timestamp('tracking_checked_at')->nullable()->after('tracking_status');
                }
                if (! Schema::hasColumn('correspondence_dispatches', 'tracking_payload')) {
                    $table->json('tracking_payload')->nullable()->after('tracking_checked_at');
                }
            });
        }

        if (Schema::hasTable('correspondence')) {
            Schema::table('correspondence', function (Blueprint $table) {
                if (! Schema::hasColumn('correspondence', 'language_tags')) {
                    $table->json('language_tags')->nullable()->after('language');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('correspondence') && Schema::hasColumn('correspondence', 'language_tags')) {
            Schema::table('correspondence', function (Blueprint $table) {
                $table->dropColumn('language_tags');
            });
        }
        if (Schema::hasTable('correspondence_dispatches')) {
            Schema::table('correspondence_dispatches', function (Blueprint $table) {
                foreach (['courier_carrier', 'tracking_number', 'tracking_status', 'tracking_checked_at', 'tracking_payload'] as $col) {
                    if (Schema::hasColumn('correspondence_dispatches', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }
        Schema::dropIfExists('payroll_import_lines');
        Schema::dropIfExists('payroll_import_batches');
        if (Schema::hasColumn('assignments', 'estimated_hours')) {
            Schema::table('assignments', function (Blueprint $table) {
                $table->dropColumn('estimated_hours');
            });
        }
        Schema::dropIfExists('assignment_dependencies');
        Schema::dropIfExists('budget_contribution_schedules');
        Schema::dropIfExists('budget_fx_rates');
    }
};
