<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * P1 extensions and renewals (PRD §72–§74). An extension changes duration only;
 * a renewal is a new period based on a contractual right and is distinct from an
 * extension. Auto-renewal contracts are flagged so deadline alerts can fire.
 */
return new class extends Migration
{
    private array $grantTables = ['contract_extensions', 'contract_renewals'];

    public function up(): void
    {
        Schema::table('contracts', function (Blueprint $table): void {
            // non_renewable | renewable_once | renewable_multiple | automatic | subject_to_approval
            $table->string('renewal_type', 30)->nullable()->after('renewal_decision_date');
            $table->boolean('auto_renew')->default(false)->after('renewal_type');
            $table->integer('renewals_count')->default(0)->after('auto_renew');
        });

        Schema::create('contract_extensions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->date('current_end_date')->nullable();
            $table->date('proposed_end_date');
            $table->text('reason');
            $table->text('impact')->nullable();
            $table->decimal('financial_impact', 18, 2)->nullable();
            $table->string('status', 20)->default('pending'); // pending|approved|rejected
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'contract_id']);
        });

        Schema::create('contract_renewals', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->integer('renewal_number')->default(1);
            $table->date('new_start_date');
            $table->date('new_end_date');
            $table->text('reason')->nullable();
            $table->boolean('procurement_validated')->default(false);
            $table->boolean('budget_confirmed')->default(false);
            $table->string('status', 20)->default('pending'); // pending|approved|rejected
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
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
        Schema::dropIfExists('contract_renewals');
        Schema::dropIfExists('contract_extensions');
        Schema::table('contracts', function (Blueprint $table): void {
            $table->dropColumn(['renewal_type', 'auto_renew', 'renewals_count']);
        });
    }
};
