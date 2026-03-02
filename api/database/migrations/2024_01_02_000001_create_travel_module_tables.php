<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1) DSA Rate table (no dependencies)
        Schema::create('dsa_rates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('country');
            $table->string('city')->nullable();
            $table->decimal('rate_per_day', 10, 2);
            $table->string('currency', 3)->default('USD');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['tenant_id', 'country', 'city']);
        });
    }
};
