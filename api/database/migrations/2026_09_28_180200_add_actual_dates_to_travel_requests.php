<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('travel_requests', function (Blueprint $table) {
            $table->date('actual_departure_date')->nullable()->after('departure_date');
            $table->date('actual_return_date')->nullable()->after('return_date');
        });
    }

    public function down(): void
    {
        Schema::table('travel_requests', function (Blueprint $table) {
            $table->dropColumn(['actual_departure_date', 'actual_return_date']);
        });
    }
};
