<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('portfolios', function (Blueprint $column) {
            $column->id();
            $column->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $column->string('name');
            $column->text('description')->nullable();
            $column->string('color')->nullable();
            $column->timestamps();
            $column->softDeletes();
        });

        Schema::create('portfolio_user', function (Blueprint $column) {
            $column->foreignId('portfolio_id')->constrained()->cascadeOnDelete();
            $column->foreignId('user_id')->constrained()->cascadeOnDelete();
            $column->primary(['portfolio_id', 'user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('portfolio_user');
        Schema::dropIfExists('portfolios');
    }
};
