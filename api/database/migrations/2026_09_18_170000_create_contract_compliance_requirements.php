<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Configurable contract compliance requirements (PRD §81–§82). Requirements are
 * defined per contract type (or for all types) and matched against uploaded
 * contract_compliance_documents by code. Unmet blocking requirements surface in
 * readiness and can block activation and/or payment.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contract_compliance_requirements', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('code', 80);
            $table->string('name');
            $table->text('description')->nullable();
            $table->foreignId('contract_type_id')->nullable()->constrained('contract_types')->nullOnDelete();
            $table->boolean('requires_expiry')->default(false);
            $table->boolean('blocks_activation')->default(false);
            $table->boolean('blocks_payment')->default(false);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'is_active']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE contract_compliance_requirements TO app_user');
            DB::statement('GRANT USAGE, SELECT ON SEQUENCE contract_compliance_requirements_id_seq TO app_user');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('contract_compliance_requirements');
    }
};
