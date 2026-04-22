<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('balance_verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transaction_id')->constrained('balance_transactions')->cascadeOnDelete();
            $table->foreignId('verified_by')->constrained('users');
            $table->string('status'); // approved, rejected, correction_requested
            $table->text('comments')->nullable();
            $table->timestamp('verified_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('balance_verifications');
    }
};
