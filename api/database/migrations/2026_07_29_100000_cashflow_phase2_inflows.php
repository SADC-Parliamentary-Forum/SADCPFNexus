<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cashflow_inflows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('financial_year_id')->constrained('financial_years')->cascadeOnDelete();
            $table->string('source_type', 32); // membership|donor|other
            $table->string('label');
            $table->string('counterparty_name')->nullable();
            $table->string('period', 7); // YYYY-MM
            $table->decimal('amount', 15, 2);
            $table->string('currency', 3)->default('NAD');
            $table->string('status', 24)->default('planned'); // planned|confirmed|received|cancelled
            $table->foreignId('funding_source_id')->nullable()->constrained('funding_sources')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'financial_year_id', 'status']);
            $table->index(['tenant_id', 'period']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cashflow_inflows');
    }
};
