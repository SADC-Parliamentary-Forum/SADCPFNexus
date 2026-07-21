<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('programmes', function (Blueprint $table) {
            $table->index('amended_from_id');
            $table->index('conflict_declared_by');
            $table->index('declaration_confirmed_by');
        });
    }

    public function down(): void
    {
        Schema::table('programmes', function (Blueprint $table) {
            $table->dropIndex(['amended_from_id']);
            $table->dropIndex(['conflict_declared_by']);
            $table->dropIndex(['declaration_confirmed_by']);
        });
    }
};
