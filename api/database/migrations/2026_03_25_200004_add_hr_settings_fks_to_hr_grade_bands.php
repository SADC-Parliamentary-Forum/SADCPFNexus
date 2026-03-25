<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hr_grade_bands', function (Blueprint $table) {
            if (! Schema::hasColumn('hr_grade_bands', 'contract_type_id')) {
                $table->unsignedBigInteger('contract_type_id')->nullable()->after('job_family_id');
                $table->foreign('contract_type_id')->references('id')->on('hr_contract_types')->nullOnDelete();
            }
            if (! Schema::hasColumn('hr_grade_bands', 'leave_profile_id')) {
                $table->unsignedBigInteger('leave_profile_id')->nullable()->after('contract_type_id');
                $table->foreign('leave_profile_id')->references('id')->on('hr_leave_profiles')->nullOnDelete();
            }
            if (! Schema::hasColumn('hr_grade_bands', 'allowance_profile_id')) {
                $table->unsignedBigInteger('allowance_profile_id')->nullable()->after('leave_profile_id');
                $table->foreign('allowance_profile_id')->references('id')->on('hr_allowance_profiles')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('hr_grade_bands', function (Blueprint $table) {
            $table->dropForeign(['contract_type_id']);
            $table->dropForeign(['leave_profile_id']);
            $table->dropForeign(['allowance_profile_id']);
            $table->dropColumn(['contract_type_id', 'leave_profile_id', 'allowance_profile_id']);
        });
    }
};
