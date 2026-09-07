<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('asset_categories', function (Blueprint $table) {
            if (! Schema::hasColumn('asset_categories', 'useful_life_years')) {
                $table->unsignedTinyInteger('useful_life_years')->nullable()->after('sort_order');
            }
        });
    }

    public function down(): void
    {
        Schema::table('asset_categories', function (Blueprint $table) {
            if (Schema::hasColumn('asset_categories', 'useful_life_years')) {
                $table->dropColumn('useful_life_years');
            }
        });
    }
};
