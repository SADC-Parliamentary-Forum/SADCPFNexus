<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('asset_code', 64)->unique();
            $table->string('name');
            $table->string('category', 32); // it, fleet, furniture, equipment
            $table->string('status', 32)->default('active'); // active, service_due, loan_out, retired
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->date('issued_at')->nullable();
            $table->decimal('value', 12, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
        Schema::table('assets', fn (Blueprint $t) => $t->index(['tenant_id', 'category']));
        Schema::table('assets', fn (Blueprint $t) => $t->index(['assigned_to']));
    }

    public function down(): void
    {
        Schema::dropIfExists('assets');
    }
};
