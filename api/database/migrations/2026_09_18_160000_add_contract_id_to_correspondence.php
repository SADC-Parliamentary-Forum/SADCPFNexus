<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Contract → Correspondence linkage (PRD §63). A correspondence item (contract
 * transmittal, signature reminder, breach/termination notice, etc.) may be
 * created from a contract and remains linked to it, so the contract workspace
 * and the Correspondence Register stay reconciled.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('correspondence', function (Blueprint $table): void {
            $table->foreignId('contract_id')->nullable()->after('programme_id')
                ->constrained('contracts')->nullOnDelete();
            $table->index(['tenant_id', 'contract_id']);
        });
    }

    public function down(): void
    {
        Schema::table('correspondence', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('contract_id');
        });
    }
};
