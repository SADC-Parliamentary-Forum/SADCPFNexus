<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Central currency reference (single source of truth) that admins can add to and
 * update, replacing free-text currency codes across the Contract module.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('currencies', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('code', 8);
            $table->string('name');
            $table->string('symbol', 12)->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['tenant_id', 'code']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE currencies TO app_user');
            DB::statement('GRANT USAGE, SELECT ON SEQUENCE currencies_id_seq TO app_user');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('currencies');
    }
};
