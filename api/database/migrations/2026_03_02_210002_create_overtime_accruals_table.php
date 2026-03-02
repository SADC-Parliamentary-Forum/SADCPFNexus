<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('overtime_accruals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('code', 50);
            $table->string('description')->nullable();
            $table->decimal('hours', 5, 1);
            $table->date('accrual_date');
            $table->string('approved_by_name')->nullable();
            $table->boolean('is_verified')->default(false);
            $table->boolean('is_linked')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('overtime_accruals');
    }
};
