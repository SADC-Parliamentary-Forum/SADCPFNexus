<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Optimistic locking for concurrent draft edits (PRD §109). lock_version is
 * compared on PATCH; a mismatch is 409 so two officers cannot silently overwrite.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contracts', function (Blueprint $table): void {
            $table->unsignedInteger('lock_version')->default(1);
        });
    }

    public function down(): void
    {
        Schema::table('contracts', function (Blueprint $table): void {
            $table->dropColumn('lock_version');
        });
    }
};
