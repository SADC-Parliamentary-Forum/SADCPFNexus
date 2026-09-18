<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Contract Authority Matrix (PRD §41) and delegated / acting authority
 * (PRD §42). Effective-dated, value-banded rules bind an action (approval or
 * signature) to an authorised role, evaluated when the action occurs. Nothing
 * here is hard-coded into workflow logic — SADC PF configures the operative
 * matrix per §41 / §134.
 */
return new class extends Migration
{
    private array $grantTables = ['contract_authority_rules', 'contract_authority_delegations'];

    public function up(): void
    {
        Schema::create('contract_authority_rules', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('action', 20); // approve|sign
            $table->foreignId('contract_type_id')->nullable()->constrained('contract_types')->nullOnDelete();
            $table->decimal('amount_floor', 18, 2)->default(0);
            $table->decimal('amount_ceiling', 18, 2)->nullable(); // null = no upper bound
            $table->string('currency', 3)->nullable(); // null = any currency
            $table->string('authorised_role');
            $table->string('alternate_role')->nullable();
            $table->date('effective_from')->nullable();
            $table->date('effective_until')->nullable();
            $table->string('policy_source')->nullable();
            $table->string('approval_reference')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'action', 'is_active']);
        });

        Schema::create('contract_authority_delegations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('delegator_role')->nullable(); // role whose authority is delegated
            $table->unsignedBigInteger('delegate_user_id'); // acting officer
            $table->string('action', 20)->nullable(); // approve|sign; null = any
            $table->text('reason')->nullable();
            $table->timestamp('effective_from');
            $table->timestamp('expires_at');
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'delegate_user_id', 'is_active']);
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
        Schema::dropIfExists('contract_authority_delegations');
        Schema::dropIfExists('contract_authority_rules');
    }
};
