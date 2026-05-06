<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('salary_advance_requests', function (Blueprint $table) {
            $table->foreignId('payslip_id')->nullable()->constrained('payslips')->nullOnDelete()->after('requester_id');
            $table->decimal('net_salary_at_request', 15, 2)->nullable()->after('payslip_id');
            $table->decimal('gross_salary_at_request', 15, 2)->nullable()->after('net_salary_at_request');
            $table->decimal('max_eligible_amount', 15, 2)->nullable()->after('gross_salary_at_request');
            $table->string('eligibility_status')->nullable()->after('max_eligible_amount');
        });
    }

    public function down(): void
    {
        Schema::table('salary_advance_requests', function (Blueprint $table) {
            $table->dropForeign(['payslip_id']);
            $table->dropColumn(['payslip_id', 'net_salary_at_request', 'gross_salary_at_request', 'max_eligible_amount', 'eligibility_status']);
        });
    }
};
