<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('asset_label_templates', function (Blueprint $table) {
            if (! Schema::hasColumn('asset_label_templates', 'layout')) {
                $table->json('layout')->nullable()->after('qr_mm');
            }
        });
    }

    public function down(): void
    {
        Schema::table('asset_label_templates', function (Blueprint $table) {
            if (Schema::hasColumn('asset_label_templates', 'layout')) {
                $table->dropColumn('layout');
            }
        });
    }
};
