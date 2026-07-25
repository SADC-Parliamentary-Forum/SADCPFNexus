<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('procurement_coi_declarations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('procurement_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->boolean('has_conflict')->default(false);
            $table->text('notes')->nullable();
            $table->string('context', 32); // assess|award
            $table->timestamps();

            $table->unique(['procurement_request_id', 'user_id', 'context']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('procurement_coi_declarations');
    }
};
