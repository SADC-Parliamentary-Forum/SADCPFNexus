<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('approval_histories', function (Blueprint $table) {
            $table->unsignedTinyInteger('step_index')->nullable()->after('action');
        });

        // Backfill existing rows with step_index = 0
        DB::statement('UPDATE approval_histories SET step_index = 0 WHERE step_index IS NULL');
    }

    public function down(): void
    {
        Schema::table('approval_histories', function (Blueprint $table) {
            $table->dropColumn('step_index');
        });
    }
};
