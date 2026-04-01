<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contracts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('procurement_request_id')->nullable();
            $table->unsignedBigInteger('vendor_id');
            $table->unsignedBigInteger('purchase_order_id')->nullable();

            $table->string('reference_number')->unique();
            $table->string('title');
            $table->text('description')->nullable();

            $table->date('start_date');
            $table->date('end_date');
            $table->decimal('value', 15, 2);
            $table->string('currency', 10)->default('NAD');

            $table->string('status', 30)->default('draft');
            // draft | active | completed | terminated

            $table->timestamp('signed_at')->nullable();
            $table->timestamp('terminated_at')->nullable();
            $table->text('termination_reason')->nullable();

            $table->unsignedBigInteger('created_by');

            $table->timestamps();
            $table->softDeletes();

            $table->foreign('vendor_id')->references('id')->on('vendors')->cascadeOnDelete();
            $table->foreign('purchase_order_id')->references('id')->on('purchase_orders')->nullOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->cascadeOnDelete();

            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'end_date']);
        });

        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON contracts TO app_user;');
        DB::statement('GRANT USAGE, SELECT ON SEQUENCE contracts_id_seq TO app_user;');
    }

    public function down(): void
    {
        Schema::dropIfExists('contracts');
    }
};
