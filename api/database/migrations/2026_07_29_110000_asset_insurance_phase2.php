<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_insurance_policies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('policy_number');
            $table->string('insurer_name');
            $table->string('coverage_type', 64)->default('all_risk');
            $table->date('effective_from');
            $table->date('effective_to');
            $table->decimal('sum_insured', 15, 2)->nullable();
            $table->decimal('premium_amount', 15, 2)->nullable();
            $table->string('currency', 3)->default('NAD');
            $table->string('status', 24)->default('active'); // active|expired|cancelled
            $table->foreignId('asset_id')->nullable()->constrained('assets')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->unique(['tenant_id', 'policy_number']);
        });

        Schema::create('asset_insurance_claims', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('policy_id')->constrained('asset_insurance_policies')->cascadeOnDelete();
            $table->foreignId('asset_id')->nullable()->constrained('assets')->nullOnDelete();
            $table->string('claim_number');
            $table->date('incident_date');
            $table->date('filed_at')->nullable();
            $table->decimal('claim_amount', 15, 2)->nullable();
            $table->decimal('settled_amount', 15, 2)->nullable();
            $table->string('currency', 3)->default('NAD');
            $table->string('status', 24)->default('draft'); // draft|filed|under_review|settled|rejected|withdrawn
            $table->text('description')->nullable();
            $table->text('outcome_notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->unique(['tenant_id', 'claim_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_insurance_claims');
        Schema::dropIfExists('asset_insurance_policies');
    }
};
