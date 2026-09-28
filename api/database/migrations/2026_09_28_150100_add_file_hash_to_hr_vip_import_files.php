<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Content hash for uploaded HR VIP import files — lets operators/UI detect an exact
 * re-upload (a renamed duplicate must not create new records, per the historical
 * migration instruction §9). Table-level GRANTs already cover new columns, so no
 * separate grant migration is needed here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hr_vip_import_files', function (Blueprint $table) {
            $table->string('file_hash', 64)->nullable()->after('storage_path');
            $table->index('file_hash');
        });
    }

    public function down(): void
    {
        Schema::table('hr_vip_import_files', function (Blueprint $table) {
            $table->dropIndex(['file_hash']);
            $table->dropColumn('file_hash');
        });
    }
};
