<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('salary_advance_policy_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('version', 32);
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->decimal('max_salary_percentage', 5, 2)->default(50);
            $table->string('salary_basis', 32)->default('net_confirmed');
            $table->unsignedTinyInteger('max_concurrent_advances')->default(1);
            $table->boolean('full_repayment_required')->default(true);
            $table->string('recovery_rule', 32)->default('full_eom');
            $table->string('final_approver_role')->default('Secretary General');
            $table->boolean('finance_certification_required')->default(true);
            $table->boolean('admin_review_required')->default(true);
            $table->json('configuration')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('active')->default(false);
            $table->timestamps();

            $table->index(['active', 'tenant_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('salary_advance_policy_versions');
    }
};
