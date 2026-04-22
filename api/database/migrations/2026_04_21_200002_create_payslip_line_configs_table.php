<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payslip_line_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('component_key', 60);
            $table->string('label', 100);
            $table->string('component_type', 20); // earning | deduction | company_contribution | info
            $table->string('source', 20)->default('manual'); // system | manual
            $table->decimal('fixed_amount', 12, 2)->nullable();
            $table->boolean('is_visible')->default(true);
            $table->unsignedTinyInteger('sort_order')->default(0);
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'component_key']);
            $table->index(['tenant_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payslip_line_configs');
    }
};
