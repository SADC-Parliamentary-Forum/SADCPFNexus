<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leave_policy_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('version', 40)->default('v1');
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->json('rules')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'is_active', 'effective_from']);
        });

        Schema::create('leave_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('policy_version_id')->nullable()->constrained('leave_policy_versions')->nullOnDelete();
            $table->string('code', 40);
            $table->string('name');
            $table->decimal('annual_entitlement', 8, 2)->nullable();
            $table->decimal('accrual_rate', 8, 4)->nullable();
            $table->string('accrual_unit', 20)->nullable();
            $table->string('cycle', 40)->default('calendar_year');
            $table->boolean('is_paid')->default(true);
            $table->boolean('allow_negative_balance')->default(false);
            $table->boolean('allow_half_day')->default(false);
            $table->boolean('requires_attachment')->default(false);
            $table->unsignedSmallInteger('medical_certificate_after_days')->nullable();
            $table->json('rules')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['tenant_id', 'code']);
        });

        Schema::table('leave_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('leave_requests', 'policy_version_id')) {
                $table->foreignId('policy_version_id')->nullable()->after('requester_id')->constrained('leave_policy_versions')->nullOnDelete();
            }
            if (! Schema::hasColumn('leave_requests', 'leave_address')) {
                $table->text('leave_address')->nullable()->after('reason');
            }
            if (! Schema::hasColumn('leave_requests', 'contact_number')) {
                $table->string('contact_number')->nullable()->after('leave_address');
            }
            if (! Schema::hasColumn('leave_requests', 'emergency_contact')) {
                $table->string('emergency_contact')->nullable()->after('contact_number');
            }
            if (! Schema::hasColumn('leave_requests', 'handover_required')) {
                $table->boolean('handover_required')->default(false)->after('emergency_contact');
            }
            if (! Schema::hasColumn('leave_requests', 'handover_notes')) {
                $table->text('handover_notes')->nullable()->after('handover_required');
            }
            if (! Schema::hasColumn('leave_requests', 'current_stage')) {
                $table->string('current_stage')->nullable()->after('status');
            }
            if (! Schema::hasColumn('leave_requests', 'current_holder')) {
                $table->string('current_holder')->nullable()->after('current_stage');
            }
        });

        Schema::create('leave_segments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('leave_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('leave_type_id')->nullable()->constrained('leave_types')->nullOnDelete();
            $table->string('leave_type', 40);
            $table->date('start_date');
            $table->date('end_date');
            $table->string('day_part', 20)->default('full');
            $table->decimal('calendar_days', 8, 2)->default(0);
            $table->decimal('weekend_days', 8, 2)->default(0);
            $table->decimal('public_holidays_excluded', 8, 2)->default(0);
            $table->decimal('working_days', 8, 2)->default(0);
            $table->decimal('balance_before', 10, 2)->nullable();
            $table->decimal('amount_requested', 10, 2)->default(0);
            $table->decimal('balance_after', 10, 2)->nullable();
            $table->string('source_type')->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('pay_treatment', 40)->nullable();
            $table->string('status', 40)->default('draft');
            $table->text('comments')->nullable();
            $table->timestamps();

            $table->index(['leave_type', 'start_date', 'end_date']);
            $table->index(['source_type', 'source_id']);
        });

        Schema::create('leave_ledger_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('leave_type_id')->nullable()->constrained('leave_types')->nullOnDelete();
            $table->foreignId('policy_version_id')->nullable()->constrained('leave_policy_versions')->nullOnDelete();
            $table->string('leave_type', 40);
            $table->string('transaction_type', 40);
            $table->decimal('amount', 10, 2);
            $table->string('unit', 20)->default('days');
            $table->date('effective_date');
            $table->string('source_type')->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('reference')->nullable();
            $table->decimal('balance_after', 10, 2)->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reason')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'user_id', 'leave_type', 'effective_date'], 'leave_ledger_lookup_idx');
            $table->index(['source_type', 'source_id']);
        });

        Schema::create('toil_credits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('credit_reference')->unique();
            $table->string('source_type');
            $table->unsignedBigInteger('source_id')->nullable();
            $table->date('duty_date');
            $table->decimal('earned_amount', 10, 2);
            $table->string('unit', 20)->default('hours');
            $table->decimal('credited_days', 10, 2)->default(0);
            $table->date('accrual_date');
            $table->date('expiry_date');
            $table->decimal('original_balance', 10, 2);
            $table->decimal('used_balance', 10, 2)->default(0);
            $table->decimal('remaining_balance', 10, 2);
            $table->string('status', 40)->default('available');
            $table->foreignId('validated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('validated_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'user_id', 'status', 'expiry_date']);
            $table->index(['source_type', 'source_id']);
        });

        Schema::create('toil_extensions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('toil_credit_id')->constrained('toil_credits')->cascadeOnDelete();
            $table->date('original_expiry_date');
            $table->date('requested_expiry_date');
            $table->text('reason');
            $table->string('status', 30)->default('pending');
            $table->date('approved_expiry_date')->nullable();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->text('comments')->nullable();
            $table->timestamps();
        });

        Schema::create('leave_payroll_impacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('leave_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('leave_type', 40);
            $table->date('start_date');
            $table->date('end_date');
            $table->string('pay_treatment', 40);
            $table->string('status', 30)->default('pending');
            $table->json('payload')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();
        });

        foreach ([
            'leave_policy_versions',
            'leave_types',
            'leave_segments',
            'leave_ledger_entries',
            'toil_credits',
            'toil_extensions',
            'leave_payroll_impacts',
        ] as $table) {
            try {
                DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO app_user");
            } catch (\Throwable) {
                // Local/test databases may not define the production RLS role.
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_payroll_impacts');
        Schema::dropIfExists('toil_extensions');
        Schema::dropIfExists('toil_credits');
        Schema::dropIfExists('leave_ledger_entries');
        Schema::dropIfExists('leave_segments');

        Schema::table('leave_requests', function (Blueprint $table) {
            if (Schema::hasColumn('leave_requests', 'policy_version_id')) {
                $table->dropConstrainedForeignId('policy_version_id');
            }

            foreach ([
                'leave_address',
                'contact_number',
                'emergency_contact',
                'handover_required',
                'handover_notes',
                'current_stage',
                'current_holder',
            ] as $column) {
                if (Schema::hasColumn('leave_requests', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::dropIfExists('leave_types');
        Schema::dropIfExists('leave_policy_versions');
    }
};
