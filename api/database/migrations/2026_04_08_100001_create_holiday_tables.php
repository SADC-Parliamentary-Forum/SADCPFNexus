<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('holiday_calendars', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('country_code', 3)->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        Schema::create('holiday_dates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('holiday_calendar_id')->constrained('holiday_calendars')->cascadeOnDelete();
            $table->string('holiday_name');
            $table->date('date');
            $table->boolean('is_paid_holiday')->default(true);
            $table->timestamps();

            $table->unique(['holiday_calendar_id', 'date']);
        });

        // Grant SELECT to app_user (PostgreSQL)
        DB::statement('GRANT SELECT ON holiday_calendars TO app_user');
        DB::statement('GRANT SELECT ON holiday_dates TO app_user');
    }

    public function down(): void
    {
        Schema::dropIfExists('holiday_dates');
        Schema::dropIfExists('holiday_calendars');
    }
};
