<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add award columns to procurement_requests
        Schema::table('procurement_requests', function (Blueprint $table) {
            $table->unsignedBigInteger('awarded_quote_id')->nullable()->after('rejection_reason');
            $table->timestamp('awarded_at')->nullable()->after('awarded_quote_id');
            $table->text('award_notes')->nullable()->after('awarded_at');

            $table->foreign('awarded_quote_id')
                  ->references('id')
                  ->on('procurement_quotes')
                  ->nullOnDelete();
        });

        // Add vendor approval tracking columns
        Schema::table('vendors', function (Blueprint $table) {
            $table->text('rejection_reason')->nullable()->after('is_active');
            $table->timestamp('approved_at')->nullable()->after('rejection_reason');
            $table->unsignedBigInteger('approved_by')->nullable()->after('approved_at');

            $table->foreign('approved_by')
                  ->references('id')
                  ->on('users')
                  ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('procurement_requests', function (Blueprint $table) {
            $table->dropForeign(['awarded_quote_id']);
            $table->dropColumn(['awarded_quote_id', 'awarded_at', 'award_notes']);
        });

        Schema::table('vendors', function (Blueprint $table) {
            $table->dropForeign(['approved_by']);
            $table->dropColumn(['rejection_reason', 'approved_at', 'approved_by']);
        });
    }
};
