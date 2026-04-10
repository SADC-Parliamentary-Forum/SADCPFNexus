<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->boolean('is_blacklisted')->default(false)->after('is_sme');
            $table->timestamp('blacklisted_at')->nullable()->after('is_blacklisted');
            $table->unsignedBigInteger('blacklisted_by')->nullable()->after('blacklisted_at');
            $table->text('blacklist_reason')->nullable()->after('blacklisted_by');
            $table->string('blacklist_reference')->nullable()->after('blacklist_reason');

            $table->foreign('blacklisted_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->dropForeign(['blacklisted_by']);
            $table->dropColumn(['is_blacklisted', 'blacklisted_at', 'blacklisted_by', 'blacklist_reason', 'blacklist_reference']);
        });
    }
};
