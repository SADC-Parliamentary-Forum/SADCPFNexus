<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Contract Management P0 schema (WS1).
 *
 * Extends the existing `contracts` table into a full lifecycle "business object"
 * and adds the P0 child tables. The physical table is retained so the existing
 * procurement contract rows are superseded via backfill rather than migration.
 *
 * Tenant isolation follows the existing `contracts` convention: application-level
 * scoping plus app_user GRANTs (the parent table does not use PostgreSQL RLS).
 */
return new class extends Migration
{
    /** Child tables that need app_user privileges for RLS-context requests. */
    private array $grantTables = [
        'contract_types', 'contract_parties', 'contract_funding_sources',
        'contract_deliverables', 'contract_obligations', 'contract_payment_schedules',
        'contract_templates', 'contract_template_versions', 'contract_document_versions',
        'contract_signatories', 'contract_amendments', 'contract_exceptions',
        'contract_compliance_documents', 'contract_number_sequences',
    ];

    public function up(): void
    {
        $this->extendContractsTable();
        $this->createReferenceTables();
        $this->createLifecycleTables();
        $this->grantAppUser();
        $this->backfillExistingContracts();
    }

    private function extendContractsTable(): void
    {
        Schema::table('contracts', function (Blueprint $table): void {
            // Origin (PRD §10)
            $table->string('origin_type', 30)->nullable()->after('tenant_id');
            $table->string('origin_reference', 500)->nullable()->after('origin_type');

            // Classification & ownership
            $table->unsignedBigInteger('type_id')->nullable()->after('tender_id');
            $table->string('counterparty_type', 20)->default('organisation')->after('vendor_id');
            $table->string('counterparty_name')->nullable()->after('counterparty_type');
            $table->unsignedBigInteger('department_id')->nullable()->after('counterparty_name');
            $table->unsignedBigInteger('contract_owner_id')->nullable()->after('department_id');
            $table->unsignedBigInteger('procurement_officer_id')->nullable()->after('contract_owner_id');
            $table->unsignedBigInteger('programme_id')->nullable()->after('procurement_officer_id');
            $table->unsignedBigInteger('project_id')->nullable()->after('programme_id');
            $table->string('donor')->nullable()->after('project_id');
            $table->unsignedBigInteger('funding_source_id')->nullable()->after('donor');
            $table->string('funding_source')->nullable()->after('funding_source_id');
            $table->string('procurement_method', 60)->nullable()->after('funding_source');
            $table->string('award_reference')->nullable()->after('procurement_method');
            $table->string('tor_reference')->nullable()->after('award_reference');
            $table->string('short_description', 500)->nullable()->after('tor_reference');

            // Financial structure (PRD §20/§21) — do not overwrite `value` (legacy).
            $table->decimal('original_value', 18, 2)->nullable()->after('value');
            $table->decimal('current_value', 18, 2)->nullable()->after('original_value');
            $table->decimal('ceiling_value', 18, 2)->nullable()->after('current_value');
            $table->decimal('rate', 18, 2)->nullable()->after('ceiling_value');
            $table->string('rate_basis', 30)->nullable()->after('rate');
            $table->decimal('units', 12, 2)->nullable()->after('rate_basis');
            $table->string('budget_currency', 10)->nullable()->after('currency');
            $table->string('conversion_reference')->nullable()->after('budget_currency');
            $table->decimal('converted_value', 18, 2)->nullable()->after('conversion_reference');

            // Dates (PRD §19) — kept separate; start_date/end_date remain operational.
            $table->date('preparation_date')->nullable()->after('end_date');
            $table->date('agreement_date')->nullable()->after('preparation_date');
            $table->date('effective_date')->nullable()->after('agreement_date');
            $table->date('service_start_date')->nullable()->after('effective_date');
            $table->date('service_end_date')->nullable()->after('service_start_date');
            $table->date('signature_deadline')->nullable()->after('service_end_date');
            $table->date('renewal_decision_date')->nullable()->after('signature_deadline');
            $table->integer('notice_period_days')->nullable()->after('renewal_decision_date');
            $table->date('closeout_target_date')->nullable()->after('notice_period_days');

            // Scope of work narrative (structured link preferred; JSON for P0 prose).
            $table->json('scope')->nullable()->after('closeout_target_date');

            // Templates & documents (soft links; tables created in this migration).
            $table->unsignedBigInteger('template_version_id')->nullable()->after('scope');
            $table->unsignedBigInteger('current_document_version_id')->nullable()->after('template_version_id');

            // Lifecycle status model (PRD §43/§44) — distinct concerns.
            $table->string('contract_status', 40)->nullable()->after('status');
            $table->string('signature_status', 30)->default('unsigned')->after('contract_status');
            $table->string('health_status', 20)->default('normal')->after('signature_status');
            $table->boolean('is_legacy')->default(false)->after('health_status');
            $table->timestamp('closed_at')->nullable()->after('terminated_at');

            $table->index(['tenant_id', 'contract_status']);
            $table->index(['tenant_id', 'contract_owner_id']);
            $table->index(['tenant_id', 'procurement_officer_id']);
            $table->index(['tenant_id', 'health_status']);
        });
    }

    private function createReferenceTables(): void
    {
        // Contract categories (PRD §9) — configurable.
        Schema::create('contract_types', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug', 80);
            $table->string('counterparty_type', 20)->default('individual'); // individual|organisation|either
            $table->string('category', 60)->nullable();
            $table->text('description')->nullable();
            $table->boolean('requires_legal_review')->default(false);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['tenant_id', 'slug']);
        });

        // Central template library + versioning (PRD §26–§29).
        Schema::create('contract_templates', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('contract_type_id')->nullable();
            $table->string('name');
            $table->string('counterparty_type', 20)->nullable();
            $table->text('description')->nullable();
            $table->string('status', 20)->default('DRAFT');
            $table->unsignedBigInteger('current_version_id')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('contract_template_versions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('template_id')->constrained('contract_templates')->cascadeOnDelete();
            $table->string('version', 20);
            $table->longText('body')->nullable();
            $table->json('variables')->nullable();
            $table->string('status', 20)->default('DRAFT'); // DRAFT|UNDER_REVIEW|APPROVED|ACTIVE|SUPERSEDED|RETIRED
            $table->date('effective_date')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('superseded_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->unique(['template_id', 'version']);
        });

        // Reserved, never-reused sequential numbering (CTR/{YYYY}/{SEQ}).
        Schema::create('contract_number_sequences', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->integer('year');
            $table->unsignedBigInteger('last_number')->default(0);
            $table->timestamps();
            $table->unique(['tenant_id', 'year']);
        });
    }

    private function createLifecycleTables(): void
    {
        // Counterparty detail (individuals; organisations reuse vendors).
        Schema::create('contract_parties', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->string('party_role', 30)->default('counterparty');
            $table->string('type', 20)->default('individual'); // individual|organisation
            $table->string('title', 30)->nullable();
            $table->string('first_name')->nullable();
            $table->string('surname')->nullable();
            $table->string('full_legal_name')->nullable();
            $table->string('email')->nullable();
            $table->string('phone', 60)->nullable();
            $table->string('id_reference')->nullable();
            $table->string('nationality', 80)->nullable();
            $table->text('address')->nullable();
            $table->string('profession')->nullable();
            $table->string('organisation')->nullable();
            $table->string('registration_number')->nullable();
            $table->string('tax_reference')->nullable();
            $table->unsignedBigInteger('vendor_id')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'contract_id']);
        });

        Schema::create('contract_funding_sources', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->unsignedBigInteger('funding_source_id')->nullable();
            $table->string('donor')->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->string('budget_line')->nullable();
            $table->decimal('amount', 18, 2)->nullable();
            $table->decimal('percentage', 5, 2)->nullable();
            $table->string('currency', 10)->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'contract_id']);
        });

        Schema::create('contract_deliverables', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->integer('number')->default(1);
            $table->string('name');
            $table->text('description')->nullable();
            $table->text('acceptance_criteria')->nullable();
            $table->string('responsible_party', 30)->default('counterparty');
            $table->unsignedBigInteger('internal_reviewer_id')->nullable();
            $table->date('due_date')->nullable();
            $table->unsignedBigInteger('payment_schedule_id')->nullable();
            $table->text('required_evidence')->nullable();
            $table->string('status', 30)->default('not_started');
            $table->unsignedBigInteger('accepted_by')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->text('review_comments')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            $table->index(['tenant_id', 'contract_id']);
        });

        Schema::create('contract_obligations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->text('obligation');
            $table->string('responsible_party', 30)->default('sadcpf'); // sadcpf|counterparty
            $table->unsignedBigInteger('owner_id')->nullable();
            $table->date('due_date')->nullable();
            $table->text('evidence')->nullable();
            $table->string('status', 30)->default('open');
            $table->timestamps();
            $table->index(['tenant_id', 'contract_id']);
        });

        Schema::create('contract_payment_schedules', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('basis', 30)->default('milestone'); // fixed|milestone|daily|monthly|quantity|retention|advance
            $table->decimal('amount', 18, 2)->nullable();
            $table->decimal('percentage', 5, 2)->nullable();
            $table->string('currency', 10)->nullable();
            $table->string('trigger_type', 40)->nullable();
            $table->unsignedBigInteger('trigger_deliverable_id')->nullable();
            $table->string('status', 30)->default('not_due'); // not_due|eligible|invoiced|paid
            $table->date('due_date')->nullable();
            $table->decimal('amount_paid', 18, 2)->default(0);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            $table->index(['tenant_id', 'contract_id']);
        });

        Schema::create('contract_document_versions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->integer('version')->default(1);
            $table->string('kind', 20)->default('working'); // working|approved|executed
            $table->unsignedBigInteger('managed_document_id')->nullable();
            $table->string('storage_path')->nullable();
            $table->string('hash', 128)->nullable();
            $table->string('hash_algorithm', 20)->nullable();
            $table->timestamp('generated_at')->nullable();
            $table->unsignedBigInteger('generated_by')->nullable();
            $table->json('signer_sequence')->nullable();
            $table->boolean('is_locked')->default(false);
            $table->timestamps();
            $table->index(['tenant_id', 'contract_id']);
        });

        Schema::create('contract_signatories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->string('party', 20)->default('sadcpf'); // sadcpf|counterparty
            $table->integer('sign_order')->default(1);
            $table->string('method', 20)->default('electronic'); // electronic|wet
            $table->unsignedBigInteger('signer_user_id')->nullable();
            $table->string('signer_name')->nullable();
            $table->string('signer_email')->nullable();
            $table->string('status', 30)->default('pending'); // pending|signed|declined|changes_requested
            $table->unsignedBigInteger('signature_event_id')->nullable();
            $table->unsignedBigInteger('document_version_id')->nullable();
            $table->timestamp('signed_at')->nullable();
            $table->text('decline_reason')->nullable();
            $table->string('token', 128)->nullable();
            $table->timestamp('token_expires_at')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'contract_id']);
            $table->index('token');
        });

        Schema::create('contract_amendments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->string('reference_number')->nullable();
            $table->integer('sequence')->default(1);
            $table->string('type', 40)->default('other');
            $table->text('reason')->nullable();
            $table->text('description')->nullable();
            $table->json('changes')->nullable();
            $table->decimal('value_delta', 18, 2)->nullable();
            $table->decimal('revised_value', 18, 2)->nullable();
            $table->date('new_end_date')->nullable();
            $table->boolean('is_material')->default(false);
            $table->string('status', 40)->default('draft');
            $table->unsignedBigInteger('approval_request_id')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'contract_id']);
        });

        Schema::create('contract_exceptions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('contract_id')->nullable();
            $table->string('type', 60);
            $table->string('severity', 20)->default('warning'); // critical|high|warning
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('status', 20)->default('open'); // open|acknowledged|resolved
            $table->unsignedBigInteger('authorised_by')->nullable();
            $table->timestamp('authorised_at')->nullable();
            $table->text('resolution')->nullable();
            $table->unsignedBigInteger('raised_by')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'contract_id']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('contract_compliance_documents', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->string('requirement_type', 80);
            $table->string('name');
            $table->unsignedBigInteger('attachment_id')->nullable();
            $table->date('issue_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->string('status', 30)->default('pending');
            $table->timestamps();
            $table->index(['tenant_id', 'contract_id']);
        });
    }

    private function grantAppUser(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach ($this->grantTables as $table) {
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {$table} TO app_user");
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
        }
    }

    /**
     * Map legacy status values onto the new lifecycle model and seed the split
     * value columns. Historical rows are marked as imported/legacy so they are
     * never misrepresented as having passed a workflow that did not exist.
     */
    private function backfillExistingContracts(): void
    {
        $map = [
            'draft' => 'DRAFT',
            'active' => 'ACTIVE',
            'completed' => 'COMPLETED',
            'terminated' => 'TERMINATED',
        ];

        foreach ($map as $legacy => $lifecycle) {
            DB::table('contracts')->where('status', $legacy)->whereNull('contract_status')
                ->update(['contract_status' => $lifecycle]);
        }

        DB::statement('UPDATE contracts SET original_value = value WHERE original_value IS NULL');
        DB::statement('UPDATE contracts SET current_value = value WHERE current_value IS NULL');
        DB::statement("UPDATE contracts SET signature_status = 'signed' WHERE signed_at IS NOT NULL AND signature_status = 'unsigned'");
        DB::statement("UPDATE contracts SET counterparty_type = 'organisation' WHERE counterparty_type IS NULL");

        // Derive origin from existing procurement linkage; otherwise legacy import.
        DB::statement("UPDATE contracts SET origin_type = 'procurement' WHERE origin_type IS NULL AND procurement_request_id IS NOT NULL");
        DB::statement("UPDATE contracts SET origin_type = 'legacy', is_legacy = true WHERE origin_type IS NULL");
    }

    public function down(): void
    {
        foreach (array_reverse($this->grantTables) as $table) {
            if ($table !== 'contract_number_sequences') {
                Schema::dropIfExists($table);
            }
        }
        Schema::dropIfExists('contract_number_sequences');

        Schema::table('contracts', function (Blueprint $table): void {
            $table->dropIndex(['tenant_id', 'contract_status']);
            $table->dropIndex(['tenant_id', 'contract_owner_id']);
            $table->dropIndex(['tenant_id', 'procurement_officer_id']);
            $table->dropIndex(['tenant_id', 'health_status']);
            $table->dropColumn([
                'origin_type', 'origin_reference', 'type_id', 'counterparty_type', 'counterparty_name',
                'department_id', 'contract_owner_id', 'procurement_officer_id', 'programme_id', 'project_id',
                'donor', 'funding_source_id', 'funding_source', 'procurement_method', 'award_reference',
                'tor_reference', 'short_description', 'original_value', 'current_value', 'ceiling_value',
                'rate', 'rate_basis', 'units', 'budget_currency', 'conversion_reference', 'converted_value',
                'preparation_date', 'agreement_date', 'effective_date', 'service_start_date', 'service_end_date',
                'signature_deadline', 'renewal_decision_date', 'notice_period_days', 'closeout_target_date',
                'scope', 'template_version_id', 'current_document_version_id', 'contract_status',
                'signature_status', 'health_status', 'is_legacy', 'closed_at',
            ]);
        });
    }
};
