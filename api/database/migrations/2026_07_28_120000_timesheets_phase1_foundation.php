<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Timesheets / Attendance / Overtime Phase 1 foundation (PRD §103 / §85 / §106).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_work_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code', 40)->nullable();
            $table->boolean('is_default')->default(false);
            $table->json('working_days'); // e.g. [1,2,3,4,5] ISO 1=Mon
            $table->time('start_time')->default('08:00:00');
            $table->time('end_time')->default('17:00:00');
            $table->time('lunch_start')->nullable()->default('13:00:00');
            $table->time('lunch_end')->nullable()->default('14:00:00');
            $table->decimal('ordinary_hours_per_day', 4, 2)->default(8);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['tenant_id', 'is_default']);
        });

        Schema::create('employee_schedule_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('work_schedule_id')->constrained('employee_work_schedules')->cascadeOnDelete();
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['user_id', 'effective_from', 'effective_to'], 'esa_user_effective_idx');
            $table->index(['tenant_id', 'user_id']);
        });

        Schema::create('timesheet_periods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->date('period_start');
            $table->date('period_end');
            $table->string('label')->nullable();
            $table->string('status', 32)->default('open'); // open|closing|closed|payroll_exported
            $table->timestamp('closed_at')->nullable();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['tenant_id', 'period_start', 'period_end'], 'timesheet_periods_unique');
        });

        Schema::create('overtime_rate_policies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('day_type', 40); // normal_working_day | weekend | public_holiday
            $table->decimal('multiplier', 4, 2)->nullable(); // null = not configured (must not invent)
            $table->boolean('is_active')->default(true);
            $table->string('policy_reference')->nullable();
            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'day_type', 'effective_from'], 'ot_rate_policy_unique');
        });

        Schema::table('timesheets', function (Blueprint $table) {
            if (! Schema::hasColumn('timesheets', 'period_id')) {
                $table->foreignId('period_id')->nullable()->after('tenant_id')->constrained('timesheet_periods')->nullOnDelete();
            }
            if (! Schema::hasColumn('timesheets', 'expected_hours')) {
                $table->decimal('expected_hours', 6, 2)->nullable()->after('overtime_hours');
            }
            if (! Schema::hasColumn('timesheets', 'accounted_hours')) {
                $table->decimal('accounted_hours', 6, 2)->nullable()->after('expected_hours');
            }
            if (! Schema::hasColumn('timesheets', 'reconciliation_status')) {
                $table->string('reconciliation_status', 32)->nullable()->after('accounted_hours'); // balanced|under|over|leave_blocked
            }
            if (! Schema::hasColumn('timesheets', 'declaration_accepted_at')) {
                $table->timestamp('declaration_accepted_at')->nullable()->after('submitted_at');
            }
            if (! Schema::hasColumn('timesheets', 'hr_validated_at')) {
                $table->timestamp('hr_validated_at')->nullable()->after('approved_at');
            }
            if (! Schema::hasColumn('timesheets', 'hr_validated_by')) {
                $table->foreignId('hr_validated_by')->nullable()->after('hr_validated_at')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('timesheets', 'returned_at')) {
                $table->timestamp('returned_at')->nullable()->after('rejection_reason');
            }
            if (! Schema::hasColumn('timesheets', 'return_reason')) {
                $table->text('return_reason')->nullable()->after('returned_at');
            }
            if (! Schema::hasColumn('timesheets', 'version')) {
                $table->unsignedInteger('version')->default(1)->after('status');
            }
        });

        // Unique open week per user (allow historical duplicates only via corrections later)
        if (! $this->indexExists('timesheets', 'timesheets_user_week_unique')) {
            Schema::table('timesheets', function (Blueprint $table) {
                $table->unique(['user_id', 'week_start'], 'timesheets_user_week_unique');
            });
        }

        Schema::table('timesheet_entries', function (Blueprint $table) {
            if (! Schema::hasColumn('timesheet_entries', 'assignment_id')) {
                $table->unsignedBigInteger('assignment_id')->nullable()->after('work_assignment_id');
                $table->index('assignment_id');
            }
            if (! Schema::hasColumn('timesheet_entries', 'pif_id')) {
                $table->unsignedBigInteger('pif_id')->nullable()->after('assignment_id');
                $table->index('pif_id');
            }
            if (! Schema::hasColumn('timesheet_entries', 'programme_id')) {
                $table->unsignedBigInteger('programme_id')->nullable()->after('pif_id');
            }
            if (! Schema::hasColumn('timesheet_entries', 'start_time')) {
                $table->time('start_time')->nullable()->after('work_date');
            }
            if (! Schema::hasColumn('timesheet_entries', 'end_time')) {
                $table->time('end_time')->nullable()->after('start_time');
            }
            if (! Schema::hasColumn('timesheet_entries', 'entry_category')) {
                $table->string('entry_category', 64)->nullable()->after('activity_type');
            }
            if (! Schema::hasColumn('timesheet_entries', 'overtime_requisition_id')) {
                $table->unsignedBigInteger('overtime_requisition_id')->nullable()->after('overtime_hours');
            }
        });

        Schema::create('timesheet_days', function (Blueprint $table) {
            $table->id();
            $table->foreignId('timesheet_id')->constrained()->cascadeOnDelete();
            $table->date('work_date');
            $table->decimal('expected_hours', 4, 2)->default(0);
            $table->decimal('ordinary_hours', 4, 2)->default(0);
            $table->decimal('overtime_hours', 4, 2)->default(0);
            $table->string('day_status', 40)->default('working'); // working|leave|travel|holiday|weekend|absent
            $table->unsignedBigInteger('leave_request_id')->nullable();
            $table->unsignedBigInteger('travel_request_id')->nullable();
            $table->string('notes', 500)->nullable();
            $table->timestamps();

            $table->unique(['timesheet_id', 'work_date']);
        });

        Schema::create('timesheet_entry_source_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('timesheet_entry_id')->constrained()->cascadeOnDelete();
            $table->string('source_type', 64); // leave|travel|assignment|pif|programme|holiday
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('source_reference')->nullable();
            $table->timestamps();

            $table->index(['source_type', 'source_id']);
        });

        Schema::create('timesheet_audit_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('timesheet_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedBigInteger('overtime_requisition_id')->nullable();
            $table->unsignedBigInteger('overtime_actual_id')->nullable();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event_type', 64);
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['timesheet_id', 'created_at']);
            $table->index(['tenant_id', 'event_type']);
        });

        Schema::create('overtime_requisitions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference', 40)->nullable();
            $table->foreignId('requested_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->date('work_date');
            $table->time('planned_start')->nullable();
            $table->time('planned_end')->nullable();
            $table->decimal('planned_hours', 5, 2);
            $table->string('day_type', 40)->default('normal_working_day'); // normal_working_day|weekend|public_holiday
            $table->string('reason', 1000);
            $table->string('work_location')->nullable();
            $table->unsignedBigInteger('assignment_id')->nullable();
            $table->unsignedBigInteger('pif_id')->nullable();
            $table->boolean('is_emergency')->default(false);
            $table->text('emergency_justification')->nullable();
            $table->string('status', 40)->default('draft');
            // draft|submitted|recommended|approved|rejected|cancelled|completed
            $table->foreignId('recommended_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('recommended_at')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('rejected_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->index(['requested_by', 'work_date']);
        });

        Schema::create('overtime_requisition_employees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('overtime_requisition_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('planned_hours', 5, 2)->nullable();
            $table->timestamps();

            $table->unique(['overtime_requisition_id', 'user_id'], 'ot_req_employee_unique');
        });

        Schema::create('overtime_actual_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('overtime_requisition_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('timesheet_id')->nullable()->constrained()->nullOnDelete();
            $table->date('work_date');
            $table->time('actual_start')->nullable();
            $table->time('actual_end')->nullable();
            $table->decimal('actual_hours', 5, 2);
            $table->decimal('planned_hours', 5, 2);
            $table->string('day_type', 40)->default('normal_working_day');
            $table->decimal('multiplier', 4, 2)->nullable();
            $table->decimal('payable_hours', 6, 2)->nullable(); // actual * multiplier when pay
            $table->string('status', 40)->default('draft');
            // draft|submitted|verified|hr_validated|settled|rejected
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->foreignId('hr_validated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('hr_validated_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->index(['overtime_requisition_id', 'user_id']);
        });

        Schema::create('overtime_settlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('overtime_actual_id')->constrained('overtime_actual_entries')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('settlement_type', 16); // pay | toil  — mutually exclusive
            $table->decimal('hours', 5, 2);
            $table->decimal('multiplier', 4, 2)->nullable();
            $table->decimal('payable_hours', 6, 2)->nullable();
            $table->string('status', 32)->default('pending'); // pending|sent|reconciled|cancelled
            $table->unsignedBigInteger('overtime_accrual_id')->nullable(); // TOIL link
            $table->unsignedBigInteger('payroll_export_line_id')->nullable();
            $table->string('idempotency_key', 80)->nullable();
            $table->foreignId('settled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('settled_at')->nullable();
            $table->timestamps();

            $table->unique(['overtime_actual_id'], 'ot_settlement_actual_unique'); // one settlement only
            $table->unique(['idempotency_key'], 'ot_settlement_idempotent_unique');
        });

        Schema::create('payroll_export_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('batch_reference', 40);
            $table->foreignId('period_id')->nullable()->constrained('timesheet_periods')->nullOnDelete();
            $table->string('status', 32)->default('draft'); // draft|exported|reconciled|cancelled
            $table->foreignId('exported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('exported_at')->nullable();
            $table->foreignId('reconciled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reconciled_at')->nullable();
            $table->string('idempotency_key', 80)->nullable()->unique();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
        });

        Schema::create('payroll_export_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('batch_id')->constrained('payroll_export_batches')->cascadeOnDelete();
            $table->foreignId('overtime_settlement_id')->constrained('overtime_settlements')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('hours', 5, 2);
            $table->decimal('payable_hours', 6, 2)->nullable();
            $table->string('day_type', 40)->nullable();
            $table->timestamps();

            $table->unique(['batch_id', 'overtime_settlement_id'], 'payroll_line_unique');
        });

        // Seed default rate policy note: only normal_working_day 1.5 — done per-tenant in service.
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_export_lines');
        Schema::dropIfExists('payroll_export_batches');
        Schema::dropIfExists('overtime_settlements');
        Schema::dropIfExists('overtime_actual_entries');
        Schema::dropIfExists('overtime_requisition_employees');
        Schema::dropIfExists('overtime_requisitions');
        Schema::dropIfExists('timesheet_audit_events');
        Schema::dropIfExists('timesheet_entry_source_links');
        Schema::dropIfExists('timesheet_days');

        Schema::table('timesheet_entries', function (Blueprint $table) {
            foreach (['assignment_id', 'pif_id', 'programme_id', 'start_time', 'end_time', 'entry_category', 'overtime_requisition_id'] as $col) {
                if (Schema::hasColumn('timesheet_entries', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        if ($this->indexExists('timesheets', 'timesheets_user_week_unique')) {
            Schema::table('timesheets', function (Blueprint $table) {
                $table->dropUnique('timesheets_user_week_unique');
            });
        }

        Schema::table('timesheets', function (Blueprint $table) {
            foreach (['period_id', 'expected_hours', 'accounted_hours', 'reconciliation_status', 'declaration_accepted_at', 'hr_validated_at', 'hr_validated_by', 'returned_at', 'return_reason', 'version'] as $col) {
                if (Schema::hasColumn('timesheets', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::dropIfExists('overtime_rate_policies');
        Schema::dropIfExists('timesheet_periods');
        Schema::dropIfExists('employee_schedule_assignments');
        Schema::dropIfExists('employee_work_schedules');
    }

    private function indexExists(string $table, string $index): bool
    {
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'pgsql') {
            $row = DB::selectOne('SELECT 1 AS ok FROM pg_indexes WHERE tablename = ? AND indexname = ?', [$table, $index]);

            return $row !== null;
        }
        if ($driver === 'sqlite') {
            $rows = DB::select("PRAGMA index_list('{$table}')");
            foreach ($rows as $r) {
                if (($r->name ?? '') === $index) {
                    return true;
                }
            }

            return false;
        }

        $db = Schema::getConnection()->getDatabaseName();
        $row = DB::selectOne(
            'SELECT 1 AS ok FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ? LIMIT 1',
            [$db, $table, $index]
        );

        return $row !== null;
    }
};
