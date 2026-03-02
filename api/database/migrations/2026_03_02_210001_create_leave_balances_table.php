<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('leave_balances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('period_year');
            $table->unsignedTinyInteger('annual_balance_days')->default(0);
            $table->decimal('lil_hours_available', 6, 1)->default(0);
            $table->unsignedTinyInteger('sick_leave_used_days')->default(0);
            $table->timestamps();

            $table->unique(['user_id', 'period_year']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_balances');
    }
};
