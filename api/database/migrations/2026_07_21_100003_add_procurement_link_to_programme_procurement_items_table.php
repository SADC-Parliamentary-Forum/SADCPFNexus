<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('programme_procurement_items', function (Blueprint $table) {
            $table->foreignId('procurement_request_id')->nullable()->constrained('procurement_requests')->nullOnDelete();
            $table->string('currency')->nullable();
            $table->boolean('rfq_required')->default(false);
            $table->index('procurement_request_id');
        });
    }

    public function down(): void
    {
        Schema::table('programme_procurement_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('procurement_request_id');
            $table->dropColumn(['currency', 'rfq_required']);
        });
    }
};
