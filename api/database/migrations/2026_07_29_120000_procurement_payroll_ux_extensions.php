<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            if (! Schema::hasColumn('contracts', 'tender_id')) {
                $table->unsignedBigInteger('tender_id')->nullable()->after('procurement_request_id');
                $table->index(['tenant_id', 'tender_id']);
            }
            if (! Schema::hasColumn('contracts', 'budget_line')) {
                $table->string('budget_line')->nullable()->after('currency');
            }
        });

        Schema::table('timesheets', function (Blueprint $table) {
            if (! Schema::hasColumn('timesheets', 'payroll_export_batch_id')) {
                $table->unsignedBigInteger('payroll_export_batch_id')->nullable()->after('hr_validated_by');
                $table->index('payroll_export_batch_id');
            }
        });

        Schema::table('payroll_export_lines', function (Blueprint $table) {
            if (! Schema::hasColumn('payroll_export_lines', 'timesheet_id')) {
                $table->unsignedBigInteger('timesheet_id')->nullable()->after('overtime_settlement_id');
                $table->index('timesheet_id');
            }
            if (! Schema::hasColumn('payroll_export_lines', 'settlement_flag')) {
                $table->string('settlement_flag', 16)->nullable()->after('day_type');
            }
            if (! Schema::hasColumn('payroll_export_lines', 'period_start')) {
                $table->date('period_start')->nullable()->after('settlement_flag');
            }
            if (! Schema::hasColumn('payroll_export_lines', 'period_end')) {
                $table->date('period_end')->nullable()->after('period_start');
            }
            if (! Schema::hasColumn('payroll_export_lines', 'employee_number')) {
                $table->string('employee_number', 64)->nullable()->after('user_id');
            }
        });

        // Allow timesheet ordinary / TOIL flag lines without an OT settlement FK.
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE payroll_export_lines ALTER COLUMN overtime_settlement_id DROP NOT NULL');
        } elseif ($driver === 'mysql') {
            DB::statement('ALTER TABLE payroll_export_lines MODIFY overtime_settlement_id BIGINT UNSIGNED NULL');
        }
    }

    public function down(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            if (Schema::hasColumn('contracts', 'tender_id')) {
                $table->dropIndex(['tenant_id', 'tender_id']);
                $table->dropColumn('tender_id');
            }
            if (Schema::hasColumn('contracts', 'budget_line')) {
                $table->dropColumn('budget_line');
            }
        });

        Schema::table('timesheets', function (Blueprint $table) {
            if (Schema::hasColumn('timesheets', 'payroll_export_batch_id')) {
                $table->dropIndex(['payroll_export_batch_id']);
                $table->dropColumn('payroll_export_batch_id');
            }
        });

        Schema::table('payroll_export_lines', function (Blueprint $table) {
            foreach (['timesheet_id', 'settlement_flag', 'period_start', 'period_end', 'employee_number'] as $col) {
                if (Schema::hasColumn('payroll_export_lines', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
