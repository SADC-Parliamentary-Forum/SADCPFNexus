<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('travel_toil_candidates', function (Blueprint $table) {
            $table->timestamp('employee_confirmed_at')->nullable()->after('reason');
            $table->string('employee_confirmation')->nullable()->after('employee_confirmed_at');
            $table->text('employee_comment')->nullable()->after('employee_confirmation');
        });
    }

    public function down(): void
    {
        Schema::table('travel_toil_candidates', function (Blueprint $table) {
            $table->dropColumn(['employee_confirmed_at', 'employee_confirmation', 'employee_comment']);
        });
    }
};
