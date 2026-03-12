<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meeting_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->nullable();
            $table->timestamps();
        });
        Schema::table('meeting_types', fn (Blueprint $t) => $t->index('tenant_id'));
    }

    public function down(): void
    {
        Schema::dropIfExists('meeting_types');
    }
};
