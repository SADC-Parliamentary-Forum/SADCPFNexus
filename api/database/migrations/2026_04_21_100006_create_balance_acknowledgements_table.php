<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('balance_acknowledgements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('register_id')->constrained('balance_registers')->cascadeOnDelete();
            $table->foreignId('transaction_id')->nullable()->constrained('balance_transactions')->nullOnDelete();
            $table->foreignId('employee_id')->constrained('users');
            $table->string('status')->default('pending'); // pending, confirmed, disputed
            $table->text('dispute_reason')->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->timestamps();

            $table->index(['register_id', 'status']);
            $table->index(['employee_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('balance_acknowledgements');
    }
};
