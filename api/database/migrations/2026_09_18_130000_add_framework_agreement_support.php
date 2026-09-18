<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * P1 framework agreements & call-offs (PRD §79). A framework is a contract with
 * a ceiling; a call-off is a contract that references its parent framework. Both
 * reuse the contracts table (single register), so no new grants are required.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contracts', function (Blueprint $table): void {
            $table->boolean('is_framework')->default(false)->after('origin_reference');
            $table->decimal('framework_ceiling', 18, 2)->nullable()->after('is_framework');
            $table->unsignedBigInteger('parent_contract_id')->nullable()->after('framework_ceiling');
            $table->index(['tenant_id', 'parent_contract_id']);
            $table->index(['tenant_id', 'is_framework']);
        });
    }

    public function down(): void
    {
        Schema::table('contracts', function (Blueprint $table): void {
            $table->dropIndex(['tenant_id', 'parent_contract_id']);
            $table->dropIndex(['tenant_id', 'is_framework']);
            $table->dropColumn(['is_framework', 'framework_ceiling', 'parent_contract_id']);
        });
    }
};
