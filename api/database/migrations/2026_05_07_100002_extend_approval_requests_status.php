<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('approval_requests', function (Blueprint $table) {
            $table->unsignedTinyInteger('returned_count')->default(0)->after('status');
        });
        // status column is already a plain string — new values 'returned' and 'withdrawn'
        // are supported without an ALTER TABLE.
    }

    public function down(): void
    {
        Schema::table('approval_requests', function (Blueprint $table) {
            $table->dropColumn('returned_count');
        });
    }
};
