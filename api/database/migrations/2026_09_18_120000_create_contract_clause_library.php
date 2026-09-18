<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * P1 clause library (PRD §30–§33): reusable, versioned clauses with clause
 * types (mandatory locked/editable, conditional, optional, donor-specific),
 * assigned to contracts with version pinning and deviation tracking.
 */
return new class extends Migration
{
    private array $grantTables = ['contract_clauses', 'contract_clause_versions', 'contract_clause_assignments'];

    public function up(): void
    {
        Schema::create('contract_clauses', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('key', 80);
            $table->string('title');
            $table->string('category', 60)->nullable();
            // mandatory_locked | mandatory_editable | conditional | optional | donor_specific
            $table->string('clause_type', 30)->default('optional');
            $table->string('donor')->nullable();
            $table->text('condition_note')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('current_version_id')->nullable();
            $table->integer('sort_order')->default(0);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'key']);
        });

        Schema::create('contract_clause_versions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('clause_id')->constrained('contract_clauses')->cascadeOnDelete();
            $table->string('version', 20);
            $table->longText('body');
            $table->string('status', 20)->default('DRAFT'); // DRAFT|ACTIVE|SUPERSEDED|RETIRED
            $table->date('effective_date')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('superseded_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->unique(['clause_id', 'version']);
        });

        Schema::create('contract_clause_assignments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->foreignId('clause_id')->constrained('contract_clauses')->cascadeOnDelete();
            $table->unsignedBigInteger('clause_version_id')->nullable();
            $table->boolean('is_deviation')->default(false);
            $table->longText('deviation_text')->nullable();
            $table->text('deviation_reason')->nullable();
            $table->unsignedBigInteger('deviation_author')->nullable();
            $table->unsignedBigInteger('deviation_reviewer')->nullable();
            $table->string('deviation_status', 20)->nullable(); // pending|approved|rejected
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            $table->index(['tenant_id', 'contract_id']);
            $table->unique(['contract_id', 'clause_id']);
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
        Schema::dropIfExists('contract_clause_assignments');
        Schema::dropIfExists('contract_clause_versions');
        Schema::dropIfExists('contract_clauses');
    }
};
