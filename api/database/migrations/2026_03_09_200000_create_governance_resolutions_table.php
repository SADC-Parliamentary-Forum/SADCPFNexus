<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('governance_resolutions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference_number', 64);
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('status', 32)->default('draft'); // draft, adopted, withdrawn
            $table->date('adopted_at')->nullable();
            $table->timestamps();
        });
        Schema::table('governance_resolutions', fn (Blueprint $t) => $t->index(['tenant_id']));
    }

    public function down(): void
    {
        Schema::dropIfExists('governance_resolutions');
    }
};
