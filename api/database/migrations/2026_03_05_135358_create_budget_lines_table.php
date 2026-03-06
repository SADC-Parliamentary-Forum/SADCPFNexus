<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('budget_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('budget_id')->constrained()->cascadeOnDelete();
            $table->string('category');
            $table->string('account_code')->nullable();
            $table->text('description')->nullable();
            $table->decimal('amount_allocated', 15, 2)->default(0);
            $table->decimal('amount_spent', 15, 2)->default(0);
            $table->decimal('amount_remaining', 15, 2)->storedAs('amount_allocated - amount_spent');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('budget_lines');
    }
};
