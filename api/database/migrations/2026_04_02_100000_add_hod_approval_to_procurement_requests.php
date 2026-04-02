<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('procurement_requests', function (Blueprint $table) {
            $table->unsignedBigInteger('hod_id')->nullable()->after('approved_by');
            $table->timestamp('hod_reviewed_at')->nullable()->after('hod_id');

            $table->foreign('hod_id')
                  ->references('id')
                  ->on('users')
                  ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('procurement_requests', function (Blueprint $table) {
            $table->dropForeign(['hod_id']);
            $table->dropColumn(['hod_id', 'hod_reviewed_at']);
        });
    }
};
