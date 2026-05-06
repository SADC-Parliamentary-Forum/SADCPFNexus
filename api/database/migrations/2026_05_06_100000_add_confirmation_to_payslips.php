<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payslips', function (Blueprint $table) {
            $table->enum('confirmation_status', ['pending', 'confirmed', 'rejected'])->default('pending')->after('details');
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete()->after('confirmation_status');
            $table->timestamp('confirmed_at')->nullable()->after('confirmed_by');
            $table->text('confirmation_notes')->nullable()->after('confirmed_at');
        });
    }

    public function down(): void
    {
        Schema::table('payslips', function (Blueprint $table) {
            $table->dropForeign(['confirmed_by']);
            $table->dropColumn(['confirmation_status', 'confirmed_by', 'confirmed_at', 'confirmation_notes']);
        });
    }
};
