<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->string('trading_name')->nullable()->after('name');
            $table->date('incorporation_date')->nullable()->after('trading_name');
            $table->string('business_type', 80)->nullable()->after('incorporation_date');
            $table->string('postal_address', 500)->nullable()->after('address');
            $table->json('contacts')->nullable()->after('contact_phone');
            $table->json('geographic_coverage')->nullable()->after('country');
            $table->unsignedSmallInteger('years_experience')->nullable()->after('geographic_coverage');
            $table->text('experience_summary')->nullable()->after('years_experience');
            $table->timestamp('finance_verified_at')->nullable()->after('bank_branch');
            $table->foreignId('finance_verified_by')->nullable()->after('finance_verified_at')->constrained('users')->nullOnDelete();
            $table->timestamp('critical_fields_locked_at')->nullable()->after('finance_verified_by');
        });

        Schema::table('supplier_categories', function (Blueprint $table) {
            $table->foreignId('parent_id')->nullable()->after('tenant_id')->constrained('supplier_categories')->nullOnDelete();
        });

        Schema::table('rfq_invitations', function (Blueprint $table) {
            $table->boolean('eligibility_override')->default(false)->after('notes');
            $table->foreignId('eligibility_override_by')->nullable()->after('eligibility_override')->constrained('users')->nullOnDelete();
            $table->timestamp('eligibility_override_at')->nullable()->after('eligibility_override_by');
        });

        Schema::create('vendor_owners', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
            $table->string('full_name');
            $table->string('role', 80)->nullable();
            $table->decimal('ownership_percent', 5, 2)->nullable();
            $table->string('nationality', 100)->nullable();
            $table->string('id_number', 100)->nullable();
            $table->boolean('is_beneficial_owner')->default(true);
            $table->boolean('is_pep')->default(false);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('supplier_document_requirement_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('code', 80);
            $table->string('label');
            $table->text('description')->nullable();
            $table->boolean('mandatory')->default(false);
            $table->string('country', 100)->nullable();
            $table->foreignId('supplier_category_id')->nullable()->constrained('supplier_categories')->nullOnDelete();
            $table->boolean('has_expiry')->default(false);
            $table->unsignedSmallInteger('warning_days')->default(90);
            $table->boolean('required_at_registration')->default(false);
            $table->boolean('required_for_rfq')->default(false);
            $table->string('funding_source', 80)->nullable();
            $table->boolean('requires_verification')->default(true);
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['tenant_id', 'code'], 'supplier_doc_req_types_tenant_code_unique');
        });

        Schema::create('supplier_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
            $table->foreignId('requirement_type_id')->nullable()->constrained('supplier_document_requirement_types')->nullOnDelete();
            $table->string('type_code', 80);
            $table->string('name');
            $table->string('document_number', 120)->nullable();
            $table->string('issuing_authority')->nullable();
            $table->date('issue_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->foreignId('attachment_id')->nullable()->constrained('attachments')->nullOnDelete();
            $table->string('original_filename')->nullable();
            $table->string('storage_path')->nullable();
            $table->string('mime_type', 120)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->unsignedSmallInteger('version')->default(1);
            $table->string('status', 40)->default('pending');
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->text('remarks')->nullable();
            $table->foreignId('replaces_document_id')->nullable()->constrained('supplier_documents')->nullOnDelete();
            $table->boolean('is_current')->default(true);
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['vendor_id', 'type_code', 'is_current']);
        });

        Schema::create('supplier_change_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
            $table->string('field_group', 40);
            $table->json('payload');
            $table->json('previous_payload')->nullable();
            $table->string('status', 40)->default('pending');
            $table->text('reason')->nullable();
            $table->text('review_remarks')->nullable();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('supplier_declaration_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('code', 80);
            $table->string('title');
            $table->text('body');
            $table->unsignedSmallInteger('version')->default(1);
            $table->boolean('required_at_registration')->default(true);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['tenant_id', 'code', 'version'], 'supplier_decl_templates_unique');
        });

        Schema::create('supplier_declaration_acceptances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
            $table->foreignId('template_id')->constrained('supplier_declaration_templates')->cascadeOnDelete();
            $table->foreignId('accepted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('accepted_at');
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->unique(['vendor_id', 'template_id'], 'supplier_decl_accept_unique');
        });

        Schema::create('supplier_compliance_notices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
            $table->foreignId('supplier_document_id')->nullable()->constrained('supplier_documents')->nullOnDelete();
            $table->string('window', 20);
            $table->date('notice_date');
            $table->timestamps();

            $table->unique(['supplier_document_id', 'window', 'notice_date'], 'supplier_compliance_notices_unique');
        });

        $this->migrateLegacyVendorStatuses();
        $this->seedRequirementTypesAndDeclarations();
        $this->importLegacyVendorAttachments();
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_compliance_notices');
        Schema::dropIfExists('supplier_declaration_acceptances');
        Schema::dropIfExists('supplier_declaration_templates');
        Schema::dropIfExists('supplier_change_requests');
        Schema::dropIfExists('supplier_documents');
        Schema::dropIfExists('supplier_document_requirement_types');
        Schema::dropIfExists('vendor_owners');

        Schema::table('rfq_invitations', function (Blueprint $table) {
            $table->dropForeign(['eligibility_override_by']);
            $table->dropColumn(['eligibility_override', 'eligibility_override_by', 'eligibility_override_at']);
        });

        Schema::table('supplier_categories', function (Blueprint $table) {
            $table->dropForeign(['parent_id']);
            $table->dropColumn('parent_id');
        });

        Schema::table('vendors', function (Blueprint $table) {
            $table->dropForeign(['finance_verified_by']);
            $table->dropColumn([
                'trading_name',
                'incorporation_date',
                'business_type',
                'postal_address',
                'contacts',
                'geographic_coverage',
                'years_experience',
                'experience_summary',
                'finance_verified_at',
                'finance_verified_by',
                'critical_fields_locked_at',
            ]);
        });
    }

    private function migrateLegacyVendorStatuses(): void
    {
        DB::table('vendors')->where('status', 'pending_approval')->update(['status' => 'submitted']);
        DB::table('vendors')->where('status', 'blacklisted')->update(['status' => 'debarred']);
    }

    private function seedRequirementTypesAndDeclarations(): void
    {
        $now = now();
        $types = [
            [
                'code' => 'registration_certificate',
                'label' => 'Company registration certificate',
                'mandatory' => true,
                'has_expiry' => false,
                'required_at_registration' => true,
                'required_for_rfq' => false,
                'sort_order' => 10,
            ],
            [
                'code' => 'tax_clearance',
                'label' => 'Tax clearance certificate',
                'mandatory' => true,
                'has_expiry' => true,
                'required_at_registration' => true,
                'required_for_rfq' => true,
                'sort_order' => 20,
            ],
            [
                'code' => 'company_profile',
                'label' => 'Company profile',
                'mandatory' => false,
                'has_expiry' => false,
                'required_at_registration' => true,
                'required_for_rfq' => false,
                'sort_order' => 30,
            ],
            [
                'code' => 'bank_details',
                'label' => 'Bank confirmation / proof of account',
                'mandatory' => true,
                'has_expiry' => false,
                'required_at_registration' => true,
                'required_for_rfq' => false,
                'sort_order' => 40,
            ],
            [
                'code' => 'other',
                'label' => 'Other supporting document',
                'mandatory' => false,
                'has_expiry' => false,
                'required_at_registration' => false,
                'required_for_rfq' => false,
                'sort_order' => 90,
            ],
        ];

        $declarations = [
            [
                'code' => 'code_of_conduct',
                'title' => 'Supplier Code of Conduct',
                'body' => 'I confirm that this supplier will comply with the SADC Parliamentary Forum Supplier Code of Conduct, including anti-bribery, fair dealing, and confidentiality obligations.',
            ],
            [
                'code' => 'conflict_of_interest',
                'title' => 'Conflict of Interest Declaration',
                'body' => 'I declare that any actual or potential conflicts of interest involving this supplier, its owners, or its personnel will be disclosed to Procurement before participating in a procurement process.',
            ],
            [
                'code' => 'eligibility',
                'title' => 'Eligibility Declaration',
                'body' => 'I declare that this supplier is eligible to contract with SADC PF, is not debarred or insolvent, and that the information and documents submitted are true and complete.',
            ],
        ];

        foreach (DB::table('tenants')->select('id')->get() as $tenant) {
            foreach ($types as $type) {
                DB::table('supplier_document_requirement_types')->updateOrInsert(
                    ['tenant_id' => $tenant->id, 'code' => $type['code']],
                    [
                        'label' => $type['label'],
                        'description' => null,
                        'mandatory' => $type['mandatory'],
                        'country' => null,
                        'supplier_category_id' => null,
                        'has_expiry' => $type['has_expiry'],
                        'warning_days' => 90,
                        'required_at_registration' => $type['required_at_registration'],
                        'required_for_rfq' => $type['required_for_rfq'],
                        'funding_source' => null,
                        'requires_verification' => true,
                        'is_active' => true,
                        'sort_order' => $type['sort_order'],
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]
                );
            }

            foreach ($declarations as $declaration) {
                $exists = DB::table('supplier_declaration_templates')
                    ->where('tenant_id', $tenant->id)
                    ->where('code', $declaration['code'])
                    ->where('version', 1)
                    ->exists();
                if ($exists) {
                    continue;
                }
                DB::table('supplier_declaration_templates')->insert([
                    'tenant_id' => $tenant->id,
                    'code' => $declaration['code'],
                    'title' => $declaration['title'],
                    'body' => $declaration['body'],
                    'version' => 1,
                    'required_at_registration' => true,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    private function importLegacyVendorAttachments(): void
    {
        if (! Schema::hasTable('attachments')) {
            return;
        }

        $typeIds = [];
        foreach (DB::table('supplier_document_requirement_types')->get(['id', 'tenant_id', 'code']) as $type) {
            $typeIds[$type->tenant_id][$type->code] = $type->id;
        }

        $attachments = DB::table('attachments')
            ->where('attachable_type', 'App\\Models\\Vendor')
            ->whereIn('document_type', [
                'registration_certificate',
                'tax_clearance',
                'company_profile',
                'bank_details',
                'other',
            ])
            ->orderBy('id')
            ->get();

        $now = now();
        foreach ($attachments as $attachment) {
            $already = DB::table('supplier_documents')->where('attachment_id', $attachment->id)->exists();
            if ($already) {
                continue;
            }

            $code = (string) $attachment->document_type;
            DB::table('supplier_documents')->insert([
                'tenant_id' => $attachment->tenant_id,
                'vendor_id' => $attachment->attachable_id,
                'requirement_type_id' => $typeIds[$attachment->tenant_id][$code] ?? null,
                'type_code' => $code,
                'name' => $attachment->original_filename ?: $code,
                'document_number' => null,
                'issuing_authority' => null,
                'issue_date' => null,
                'expiry_date' => $attachment->expires_at ?? null,
                'attachment_id' => $attachment->id,
                'original_filename' => $attachment->original_filename,
                'storage_path' => $attachment->storage_path,
                'mime_type' => $attachment->mime_type,
                'size_bytes' => $attachment->size_bytes,
                'version' => 1,
                'status' => 'pending',
                'is_current' => true,
                'uploaded_by' => $attachment->uploaded_by,
                'created_at' => $attachment->created_at ?? $now,
                'updated_at' => $now,
            ]);
        }
    }
};
