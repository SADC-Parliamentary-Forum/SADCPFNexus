<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('risk_kris', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('code', 64);
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('source_module', 32); // budget|assignments|leave|stock|risk
            $table->string('source_key', 64);
            $table->string('unit', 24)->default('count'); // percent|count
            $table->string('direction', 32)->default('higher_is_worse');
            $table->decimal('warning_threshold', 12, 2)->nullable();
            $table->decimal('breach_threshold', 12, 2)->nullable();
            $table->foreignId('risk_id')->nullable()->constrained('risks')->nullOnDelete();
            $table->foreignId('strategic_objective_id')->nullable()->constrained('strategic_objectives')->nullOnDelete();
            $table->boolean('enabled')->default(true);
            $table->decimal('last_value', 14, 4)->nullable();
            $table->string('last_status', 16)->nullable(); // ok|warning|breach
            $table->timestamp('last_evaluated_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'code']);
            $table->index(['tenant_id', 'last_status']);
        });

        Schema::create('risk_kri_readings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('risk_kri_id')->constrained('risk_kris')->cascadeOnDelete();
            $table->decimal('value', 14, 4);
            $table->string('status', 16); // ok|warning|breach
            $table->timestamp('evaluated_at');
            $table->json('meta')->nullable();
            $table->timestamp('breach_notified_at')->nullable();
            $table->timestamps();

            $table->index(['risk_kri_id', 'evaluated_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('risk_kri_readings');
        Schema::dropIfExists('risk_kris');
    }
};
