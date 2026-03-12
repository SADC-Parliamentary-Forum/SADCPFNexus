<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code', 32);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });
        Schema::table('asset_categories', fn (Blueprint $t) => $t->unique(['tenant_id', 'code']));
        Schema::table('asset_categories', fn (Blueprint $t) => $t->index('tenant_id'));
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_categories');
    }
};
