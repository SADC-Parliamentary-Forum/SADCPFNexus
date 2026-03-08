<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payslips', function (Blueprint $table) {
            $table->string('employment_type', 32)->nullable()->after('currency'); // local | regional | researcher
            $table->date('period_end_date')->nullable()->after('period_year');
            $table->decimal('total_deductions', 12, 2)->nullable()->after('net_amount');
            $table->decimal('total_company_contributions', 12, 2)->nullable()->after('total_deductions');
            $table->json('details')->nullable()->after('total_company_contributions');
        });
    }

    public function down(): void
    {
        Schema::table('payslips', function (Blueprint $table) {
            $table->dropColumn([
                'employment_type',
                'period_end_date',
                'total_deductions',
                'total_company_contributions',
                'details',
            ]);
        });
    }
};
