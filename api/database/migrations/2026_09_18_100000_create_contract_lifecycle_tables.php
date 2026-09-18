<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * P1 contract lifecycle administration: suspension and termination records
 * (PRD §75–§77). Termination never deletes the contract; both are audited
 * child records. Tenant isolation follows the app_user GRANT convention.
 */
return new class extends Migration
{
    private array $grantTables = ['contract_suspensions', 'contract_terminations'];

    public function up(): void
    {
        Schema::create('contract_suspensions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->date('effective_date');
            $table->text('reason');
            $table->unsignedBigInteger('approving_authority_id')->nullable();
            $table->text('affected_obligations')->nullable();
            $table->text('payment_impact')->nullable();
            $table->text('restart_conditions')->nullable();
            $table->date('resumption_date')->nullable();
            $table->string('status', 20)->default('active'); // active|lifted
            $table->unsignedBigInteger('lifted_by')->nullable();
            $table->timestamp('lifted_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'contract_id']);
        });

        Schema::create('contract_terminations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->string('type', 30); // convenience|cause|mutual|force_majeure|other
            $table->text('reason');
            $table->string('notice_reference')->nullable();
            $table->date('effective_date');
            $table->text('outstanding_obligations')->nullable();
            $table->decimal('final_amount', 18, 2)->nullable();
            $table->string('dispute_status', 40)->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'contract_id']);
        });

        if (DB::getDriverName() === 'pgsql') {
            foreach ($this->grantTables as $t) {
                DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {$t} TO app_user");
                DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$t}_id_seq TO app_user");
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('contract_terminations');
        Schema::dropIfExists('contract_suspensions');
    }
};
