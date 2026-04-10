<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('timesheet_entries', function (Blueprint $table) {
            $table->string('source_type')->default('manual')->after('description');
            // manual | leave | travel | holiday
            $table->unsignedBigInteger('source_record_id')->nullable()->after('source_type');
            $table->boolean('is_locked')->default(false)->after('source_record_id');
        });

        Schema::table('timesheets', function (Blueprint $table) {
            $table->unsignedSmallInteger('week_number')->nullable()->after('week_end');
        });
    }

    public function down(): void
    {
        Schema::table('timesheet_entries', function (Blueprint $table) {
            $table->dropColumn(['source_type', 'source_record_id', 'is_locked']);
        });

        Schema::table('timesheets', function (Blueprint $table) {
            $table->dropColumn('week_number');
        });
    }
};
