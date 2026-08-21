<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('programmes') || Schema::hasColumn('programmes', 'media_liaison_rate')) {
            return;
        }

        Schema::table('programmes', function (Blueprint $table) {
            $table->decimal('media_liaison_rate', 10, 2)->nullable()->after('media_liaison_count');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('programmes') || ! Schema::hasColumn('programmes', 'media_liaison_rate')) {
            return;
        }

        Schema::table('programmes', function (Blueprint $table) {
            $table->dropColumn('media_liaison_rate');
        });
    }
};
