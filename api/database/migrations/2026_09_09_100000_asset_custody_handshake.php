<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->string('custody_state', 32)->nullable()->after('acknowledgement_at');
        });

        Schema::table('asset_assignment_histories', function (Blueprint $table) {
            $table->timestamp('declined_at')->nullable()->after('acknowledged_at');
            $table->string('decline_reason', 2000)->nullable()->after('declined_at');
            $table->timestamp('return_requested_at')->nullable()->after('decline_reason');
            $table->unsignedBigInteger('return_requested_by')->nullable()->after('return_requested_at');
            $table->string('condition_at_return', 64)->nullable()->after('returned_at');
        });
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn('custody_state');
        });
        Schema::table('asset_assignment_histories', function (Blueprint $table) {
            $table->dropColumn([
                'declined_at',
                'decline_reason',
                'return_requested_at',
                'return_requested_by',
                'condition_at_return',
            ]);
        });
    }
};
