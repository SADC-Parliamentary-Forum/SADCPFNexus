<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('travel_toil_candidates', function (Blueprint $table) {
            $table->text('amendment_review_reason')->nullable()->after('rejection_reason');
        });
    }

    public function down(): void
    {
        Schema::table('travel_toil_candidates', function (Blueprint $table) {
            $table->dropColumn('amendment_review_reason');
        });
    }
};
