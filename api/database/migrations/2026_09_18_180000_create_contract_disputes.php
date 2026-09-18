<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Optional contract dispute sub-record (PRD §78). Disputes are audited child
 * records of a contract and never mutate the contract itself.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contract_disputes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->string('type', 40); // payment|performance|scope|delay|quality|other
            $table->text('description');
            $table->date('date_raised');
            $table->text('counterparty_claim')->nullable();
            $table->unsignedBigInteger('internal_owner_id')->nullable();
            $table->boolean('legal_involved')->default(false);
            $table->decimal('amount_at_risk', 18, 2)->nullable();
            $table->string('status', 30)->default('open'); // open|under_review|escalated|resolved|closed
            $table->text('resolution')->nullable();
            $table->date('resolved_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'contract_id']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE contract_disputes TO app_user');
            DB::statement('GRANT USAGE, SELECT ON SEQUENCE contract_disputes_id_seq TO app_user');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('contract_disputes');
    }
};
