<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Key personnel for service contracts (PRD §80). Named personnel are tracked
 * per contract; replacing a key person is a formal, approved change captured as
 * an audited replacement request rather than a silent edit.
 */
return new class extends Migration
{
    private array $grantTables = ['contract_key_personnel', 'contract_personnel_replacements'];

    public function up(): void
    {
        Schema::create('contract_key_personnel', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->string('name');
            $table->string('role');
            $table->string('email')->nullable();
            $table->string('cv_reference')->nullable();
            $table->boolean('is_key')->default(true);
            $table->string('status', 20)->default('active'); // active|replaced
            $table->unsignedBigInteger('replaced_by_id')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'contract_id']);
        });

        Schema::create('contract_personnel_replacements', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->foreignId('personnel_id')->constrained('contract_key_personnel')->cascadeOnDelete();
            $table->string('proposed_name');
            $table->string('proposed_role');
            $table->string('proposed_email')->nullable();
            $table->string('proposed_cv_reference')->nullable();
            $table->text('reason');
            $table->string('status', 20)->default('pending'); // pending|approved|rejected
            $table->unsignedBigInteger('requested_by')->nullable();
            $table->unsignedBigInteger('decided_by')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->text('decision_note')->nullable();
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
        Schema::dropIfExists('contract_personnel_replacements');
        Schema::dropIfExists('contract_key_personnel');
    }
};
