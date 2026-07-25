<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('salary_advance_requests', function (Blueprint $table) {
            $table->foreignId('policy_version_id')->nullable()->after('eligibility_status')
                ->constrained('salary_advance_policy_versions')->nullOnDelete();
            $table->string('salary_basis', 32)->nullable()->after('policy_version_id');
            $table->decimal('approved_amount', 15, 2)->nullable()->after('amount');

            $table->boolean('deduction_authority_confirmed')->default(false)->after('justification');
            $table->string('deduction_authority_version', 64)->nullable()->after('deduction_authority_confirmed');
            $table->timestamp('deduction_authority_confirmed_at')->nullable()->after('deduction_authority_version');

            $table->date('intended_recovery_payroll_date')->nullable()->after('deduction_authority_confirmed_at');

            $table->timestamp('finance_certified_at')->nullable()->after('intended_recovery_payroll_date');
            $table->foreignId('finance_certified_by')->nullable()->after('finance_certified_at')
                ->constrained('users')->nullOnDelete();
            $table->text('not_eligible_reason')->nullable()->after('finance_certified_by');

            $table->string('payment_status', 32)->nullable()->after('not_eligible_reason');
            $table->timestamp('paid_at')->nullable()->after('payment_status');
            $table->string('payment_reference')->nullable()->after('paid_at');
            $table->string('payment_method', 64)->nullable()->after('payment_reference');

            $table->string('recovery_status', 32)->nullable()->after('payment_method');
            $table->decimal('recovered_amount', 15, 2)->nullable()->after('recovery_status');
            $table->timestamp('closed_at')->nullable()->after('recovered_amount');
        });

        Schema::create('salary_advance_finance_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('salary_advance_request_id')->constrained('salary_advance_requests')->cascadeOnDelete();
            $table->foreignId('reviewed_by')->constrained('users')->cascadeOnDelete();
            $table->string('outcome', 32); // certified, returned, not_eligible
            $table->string('salary_basis', 32)->nullable();
            $table->decimal('confirmed_net_salary', 15, 2)->nullable();
            $table->decimal('confirmed_gross_salary', 15, 2)->nullable();
            $table->decimal('max_eligible_amount', 15, 2)->nullable();
            $table->decimal('recommended_amount', 15, 2)->nullable();
            $table->date('intended_recovery_payroll_date')->nullable();
            $table->boolean('eligible')->nullable();
            $table->text('comments')->nullable();
            $table->text('return_reason')->nullable();
            $table->text('not_eligible_reason')->nullable();
            $table->json('worksheet')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('salary_advance_finance_reviews');

        Schema::table('salary_advance_requests', function (Blueprint $table) {
            $table->dropForeign(['policy_version_id']);
            $table->dropForeign(['finance_certified_by']);
            $table->dropColumn([
                'policy_version_id',
                'salary_basis',
                'approved_amount',
                'deduction_authority_confirmed',
                'deduction_authority_version',
                'deduction_authority_confirmed_at',
                'intended_recovery_payroll_date',
                'finance_certified_at',
                'finance_certified_by',
                'not_eligible_reason',
                'payment_status',
                'paid_at',
                'payment_reference',
                'payment_method',
                'recovery_status',
                'recovered_amount',
                'closed_at',
            ]);
        });
    }
};
