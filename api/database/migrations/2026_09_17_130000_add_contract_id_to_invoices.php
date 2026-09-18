<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Link invoices directly to a contract so the financial ledger and payment
 * controls (ceiling, milestone acceptance) can operate (PRD §58/§59).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('invoices', 'contract_id')) {
            Schema::table('invoices', function (Blueprint $table): void {
                $table->unsignedBigInteger('contract_id')->nullable()->after('purchase_order_id');
                $table->unsignedBigInteger('contract_payment_schedule_id')->nullable()->after('contract_id');
                $table->index('contract_id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('invoices', 'contract_id')) {
            Schema::table('invoices', function (Blueprint $table): void {
                $table->dropIndex(['contract_id']);
                $table->dropColumn(['contract_id', 'contract_payment_schedule_id']);
            });
        }
    }
};
