<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
            $table->text('justification');
            $table->string('status', 32)->default('pending'); // pending, approved, rejected
            $table->string('document_path')->nullable();
            $table->timestamps();
        });
        Schema::table('asset_requests', fn (Blueprint $t) => $t->index(['tenant_id', 'status']));
        Schema::table('asset_requests', fn (Blueprint $t) => $t->index(['requester_id']));
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_requests');
    }
};
