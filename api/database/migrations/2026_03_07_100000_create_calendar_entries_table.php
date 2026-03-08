<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('calendar_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('type', 32); // sadc_holiday | un_day | sadc_calendar
            $table->string('country_code', 3)->nullable(); // ISO 3166-1 alpha-2: NA, ZW, ZA, BW, etc. Null for UN days (global)
            $table->date('date');
            $table->string('title');
            $table->text('description')->nullable();
            $table->boolean('is_alert')->default(false); // true = show in alerts (used for UN days)
            $table->timestamps();
        });

        Schema::table('calendar_entries', function (Blueprint $table) {
            $table->index(['tenant_id', 'type', 'date']);
            $table->index(['tenant_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calendar_entries');
    }
};
