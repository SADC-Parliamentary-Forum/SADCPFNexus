<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('programme_procurement_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('programme_id')->constrained()->cascadeOnDelete();
            $table->string('description');
            $table->decimal('estimated_cost', 12, 2);
            $table->string('method')->default('direct_purchase');
            // direct_purchase|three_quotations|tender
            $table->string('vendor')->nullable();
            $table->date('delivery_date')->nullable();
            $table->string('status')->default('pending');
            // pending|ordered|delivered|cancelled
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('programme_procurement_items');
    }
};
