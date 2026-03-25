<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hr_grade_bands', function (Blueprint $table) {
            if (! Schema::hasColumn('hr_grade_bands', 'appraisal_template_id')) {
                $table->unsignedBigInteger('appraisal_template_id')->nullable()->after('allowance_profile_id');
                $table->foreign('appraisal_template_id')->references('id')->on('hr_appraisal_templates')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('hr_grade_bands', function (Blueprint $table) {
            $table->dropForeign(['appraisal_template_id']);
            $table->dropColumn('appraisal_template_id');
        });
    }
};
