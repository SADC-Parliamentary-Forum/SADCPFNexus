<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('positions', function (Blueprint $table) {
            // Nullable FK alongside the existing freetext `grade` column (kept for backward compat)
            $table->foreignId('grade_band_id')
                ->nullable()
                ->after('grade')
                ->constrained('hr_grade_bands')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('positions', function (Blueprint $table) {
            $table->dropForeign(['grade_band_id']);
            $table->dropColumn('grade_band_id');
        });
    }
};
