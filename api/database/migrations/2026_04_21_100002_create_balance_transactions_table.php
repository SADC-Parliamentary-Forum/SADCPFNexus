<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('balance_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('register_id')->constrained('balance_registers')->cascadeOnDelete();
            $table->string('type'); // disbursement, recovery, adjustment, write_off
            $table->decimal('amount', 12, 2);
            $table->decimal('previous_balance', 12, 2);
            $table->decimal('new_balance', 12, 2);
            $table->string('reference_doc', 200)->nullable();
            $table->text('notes')->nullable();
            $table->string('supporting_document_path')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->string('verification_status')->default('pending'); // pending, approved, rejected
            $table->timestamps();

            $table->index(['register_id', 'verification_status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('balance_transactions');
    }
};
