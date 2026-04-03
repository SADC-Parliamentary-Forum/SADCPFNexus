<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('procurement_requests', function (Blueprint $table) {
            $table->timestamp('rfq_issued_at')->nullable()->after('awarded_at');
            $table->date('rfq_deadline')->nullable()->after('rfq_issued_at');
            $table->text('rfq_notes')->nullable()->after('rfq_deadline');
        });
    }

    public function down(): void {
        Schema::table('procurement_requests', function (Blueprint $table) {
            $table->dropColumn(['rfq_issued_at', 'rfq_deadline', 'rfq_notes']);
        });
    }
};
