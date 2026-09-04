<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('procurement_projects', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->string('code', 40);
            $table->string('name');
            $table->string('funding_source', 80)->default('core');
            $table->string('donor_id', 80)->nullable();
            $table->unsignedBigInteger('programme_id')->nullable();
            $table->unsignedBigInteger('policy_profile_id')->nullable();
            $table->string('account_code', 80)->nullable();
            $table->string('cost_centre', 80)->nullable();
            $table->boolean('allows_no_po_payment')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('programme_id')->references('id')->on('programmes')->nullOnDelete();
            $table->unique(['tenant_id', 'code']);
        });

        Schema::create('procurement_document_intakes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('uploaded_by');
            $table->unsignedBigInteger('attachment_id')->nullable();
            $table->string('source_type', 40)->default('upload');
            $table->string('original_filename');
            $table->string('mime_type', 120);
            $table->string('file_hash', 64);
            $table->unsignedBigInteger('file_size_bytes')->default(0);
            $table->string('document_type', 40)->nullable();
            $table->unsignedTinyInteger('classification_confidence')->nullable();
            $table->string('classification_method', 40)->nullable();
            $table->boolean('needs_manual_classification')->default(false);
            $table->string('extraction_status', 40)->default('received');
            $table->unsignedTinyInteger('extraction_confidence')->nullable();
            $table->json('raw_extraction')->nullable();
            $table->json('corrected_extraction')->nullable();
            $table->unsignedBigInteger('corrected_by')->nullable();
            $table->timestamp('corrected_at')->nullable();
            $table->string('document_number')->nullable();
            $table->date('document_date')->nullable();
            $table->date('due_date')->nullable();
            $table->string('currency', 3)->nullable();
            $table->boolean('currency_ambiguous')->default(false);
            $table->string('payment_terms')->nullable();
            $table->string('supplier_name_raw')->nullable();
            $table->string('supplier_email_raw')->nullable();
            $table->string('supplier_phone_raw')->nullable();
            $table->string('supplier_tax_number_raw')->nullable();
            $table->string('supplier_registration_raw')->nullable();
            $table->json('supplier_address_raw')->nullable();
            $table->json('bank_details_raw')->nullable();
            $table->boolean('bank_mismatch')->default(false);
            $table->decimal('subtotal', 15, 2)->nullable();
            $table->decimal('vat_amount', 15, 2)->nullable();
            $table->boolean('vat_identified')->default(false);
            $table->decimal('discount_amount', 15, 2)->nullable();
            $table->decimal('grand_total', 15, 2)->nullable();
            $table->json('arithmetic')->nullable();
            $table->unsignedBigInteger('vendor_id')->nullable();
            $table->string('supplier_match_status', 40)->nullable();
            $table->json('supplier_differences')->nullable();
            $table->unsignedBigInteger('procurement_request_id')->nullable();
            $table->unsignedBigInteger('purchase_order_id')->nullable();
            $table->unsignedBigInteger('procurement_project_id')->nullable();
            $table->unsignedBigInteger('duplicate_of_id')->nullable();
            $table->string('invoice_first_case', 40)->nullable();
            $table->json('policy_result')->nullable();
            $table->string('idempotency_key', 80)->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('uploaded_by')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('corrected_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('vendor_id')->references('id')->on('vendors')->nullOnDelete();
            $table->foreign('procurement_request_id')->references('id')->on('procurement_requests')->nullOnDelete();
            $table->foreign('purchase_order_id')->references('id')->on('purchase_orders')->nullOnDelete();
            $table->foreign('procurement_project_id')->references('id')->on('procurement_projects')->nullOnDelete();
            $table->foreign('duplicate_of_id')->references('id')->on('procurement_document_intakes')->nullOnDelete();
            $table->index(['tenant_id', 'file_hash']);
            $table->index(['tenant_id', 'document_number']);
            $table->index(['tenant_id', 'extraction_status']);
            $table->unique(['tenant_id', 'idempotency_key']);
        });

        Schema::create('procurement_document_intake_lines', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('intake_id');
            $table->unsignedSmallInteger('line_no');
            $table->text('source_description');
            $table->text('lpo_description')->nullable();
            $table->decimal('quantity', 15, 3)->default(1);
            $table->string('unit', 50)->nullable();
            $table->decimal('unit_price', 15, 2)->default(0);
            $table->decimal('discount', 15, 2)->nullable();
            $table->decimal('vat', 15, 2)->nullable();
            $table->decimal('line_total', 15, 2)->default(0);
            $table->unsignedTinyInteger('confidence_score')->nullable();
            $table->boolean('user_corrected')->default(false);
            $table->json('original_extracted')->nullable();
            $table->timestamps();

            $table->foreign('intake_id')->references('id')->on('procurement_document_intakes')->cascadeOnDelete();
            $table->unique(['intake_id', 'line_no']);
        });

        Schema::create('procurement_exceptions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('procurement_request_id')->nullable();
            $table->unsignedBigInteger('purchase_order_id')->nullable();
            $table->unsignedBigInteger('intake_id')->nullable();
            $table->string('exception_type', 60);
            $table->text('reason');
            $table->unsignedBigInteger('requested_by');
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->string('status', 40)->default('requested');
            $table->json('payload')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('procurement_request_id')->references('id')->on('procurement_requests')->nullOnDelete();
            $table->foreign('purchase_order_id')->references('id')->on('purchase_orders')->nullOnDelete();
            $table->foreign('intake_id')->references('id')->on('procurement_document_intakes')->nullOnDelete();
            $table->foreign('requested_by')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('approved_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['tenant_id', 'exception_type', 'status']);
        });

        Schema::create('service_confirmations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('purchase_order_id');
            $table->unsignedBigInteger('confirmed_by');
            $table->string('delivered', 20);
            $table->boolean('satisfactory')->nullable();
            $table->text('comments')->nullable();
            $table->timestamp('confirmed_at');
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('purchase_order_id')->references('id')->on('purchase_orders')->cascadeOnDelete();
            $table->foreign('confirmed_by')->references('id')->on('users')->restrictOnDelete();
            $table->index(['tenant_id', 'purchase_order_id']);
        });

        Schema::create('purchase_order_revisions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('purchase_order_id');
            $table->unsignedInteger('revision');
            $table->text('reason');
            $table->unsignedBigInteger('changed_by');
            $table->json('snapshot');
            $table->json('changes')->nullable();
            $table->timestamps();

            $table->foreign('purchase_order_id')->references('id')->on('purchase_orders')->cascadeOnDelete();
            $table->foreign('changed_by')->references('id')->on('users')->restrictOnDelete();
            $table->unique(['purchase_order_id', 'revision']);
        });

        Schema::create('procurement_inbox_messages', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->string('message_id')->nullable();
            $table->string('from_email');
            $table->string('subject')->nullable();
            $table->timestamp('received_at');
            $table->string('status', 40)->default('received');
            $table->unsignedBigInteger('intake_id')->nullable();
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('intake_id')->references('id')->on('procurement_document_intakes')->nullOnDelete();
            $table->index(['tenant_id', 'status']);
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->string('lpo_number', 40)->nullable()->after('reference_number');
            $table->unsignedBigInteger('lpo_sequence_number')->nullable()->after('lpo_number');
            $table->date('lpo_date')->nullable()->after('lpo_sequence_number');
            $table->unsignedBigInteger('procurement_project_id')->nullable()->after('vendor_id');
            $table->unsignedBigInteger('programme_id')->nullable();
            $table->unsignedBigInteger('source_intake_id')->nullable();
            $table->unsignedBigInteger('exception_id')->nullable();
            $table->unsignedBigInteger('requested_by_user_id')->nullable();
            $table->unsignedBigInteger('prepared_by_user_id')->nullable();
            $table->string('source_type', 40)->nullable();
            $table->string('procurement_method', 40)->nullable();
            $table->boolean('retrospective')->default(false);
            $table->unsignedInteger('revision')->default(1);
            $table->decimal('subtotal', 15, 2)->nullable();
            $table->decimal('tax_amount', 15, 2)->nullable();
            $table->boolean('vat_identified')->default(false);
            $table->decimal('discount_amount', 15, 2)->nullable();
            $table->string('tax_exempt_reason')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('sent_to_supplier_at')->nullable();
            $table->string('supplier_email_status', 20)->nullable();
            $table->string('supplier_email_recipient')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->unsignedBigInteger('final_pdf_attachment_id')->nullable();
            $table->string('final_document_hash', 64)->nullable();
            $table->string('finance_handover_status', 40)->nullable();
            $table->timestamp('sent_to_finance_at')->nullable();
            $table->string('void_reason')->nullable();
            $table->unsignedBigInteger('voided_by')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->string('idempotency_key', 80)->nullable();

            $table->index(['tenant_id', 'lpo_number']);
            $table->unique(['tenant_id', 'idempotency_key']);
            $table->foreign('procurement_project_id')->references('id')->on('procurement_projects')->nullOnDelete();
        });

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->text('source_description')->nullable()->after('description');
            $table->string('account_code', 80)->nullable();
            $table->decimal('vat_amount', 15, 2)->nullable();
            $table->unsignedBigInteger('source_intake_line_id')->nullable();
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->unsignedBigInteger('intake_id')->nullable()->after('vendor_id');
            $table->string('file_hash', 64)->nullable();
            $table->string('document_type', 40)->nullable();
        });

        if (Schema::hasTable('numbering_schemes')) {
            $tenants = DB::table('tenants')->pluck('id');
            foreach ($tenants as $tenantId) {
                $schemeId = DB::table('numbering_schemes')->insertGetId([
                    'tenant_id' => $tenantId,
                    'scheme_key' => 'lpo',
                    'name' => 'Local Purchase Order',
                    'prefix' => 'S',
                    'year_component' => 'none',
                    'sequence_length' => 5,
                    'reset_rule' => 'never',
                    'separator' => ' ',
                    'example' => 'S 00001',
                    'status' => 'pending_activation',
                    'metadata' => json_encode(['activation_required' => true]),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                DB::table('numbering_sequences')->insert([
                    'numbering_scheme_id' => $schemeId,
                    'period_key' => 'lifetime',
                    'current_value' => 0,
                    'voided_references' => json_encode([]),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['intake_id', 'file_hash', 'document_type']);
        });
        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->dropColumn(['source_description', 'account_code', 'vat_amount', 'source_intake_line_id']);
        });
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn([
                'lpo_number', 'lpo_sequence_number', 'lpo_date', 'procurement_project_id',
                'programme_id', 'source_intake_id', 'exception_id', 'requested_by_user_id',
                'prepared_by_user_id', 'source_type', 'procurement_method', 'retrospective',
                'revision', 'subtotal', 'tax_amount', 'vat_identified', 'discount_amount',
                'tax_exempt_reason', 'submitted_at', 'approved_at', 'sent_to_supplier_at',
                'supplier_email_status', 'supplier_email_recipient', 'closed_at',
                'final_pdf_attachment_id', 'final_document_hash', 'finance_handover_status',
                'sent_to_finance_at', 'void_reason', 'voided_by', 'voided_at', 'idempotency_key',
            ]);
        });
        Schema::dropIfExists('procurement_inbox_messages');
        Schema::dropIfExists('purchase_order_revisions');
        Schema::dropIfExists('service_confirmations');
        Schema::dropIfExists('procurement_exceptions');
        Schema::dropIfExists('procurement_document_intake_lines');
        Schema::dropIfExists('procurement_document_intakes');
        Schema::dropIfExists('procurement_projects');
    }
};
