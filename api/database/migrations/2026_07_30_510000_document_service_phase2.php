<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Document Service Phase 1–2 PRD extension (§122–§123).
 * Extends Phase 1 managed_documents / document_versions — does not rebuild.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('managed_documents')) {
            Schema::table('managed_documents', function (Blueprint $table) {
                if (! Schema::hasColumn('managed_documents', 'legal_hold')) {
                    $table->boolean('legal_hold')->default(false)->after('classification');
                    $table->text('legal_hold_reason')->nullable()->after('legal_hold');
                    $table->foreignId('legal_hold_set_by')->nullable()->after('legal_hold_reason')
                        ->constrained('users')->nullOnDelete();
                    $table->timestamp('legal_hold_set_at')->nullable()->after('legal_hold_set_by');
                    $table->string('retention_policy', 64)->nullable()->after('legal_hold_set_at');
                    $table->date('retain_until')->nullable()->after('retention_policy');
                    $table->timestamp('purged_at')->nullable()->after('retain_until');
                    $table->foreignId('purged_by')->nullable()->after('purged_at')
                        ->constrained('users')->nullOnDelete();
                    $table->index(['tenant_id', 'legal_hold']);
                }
                if (! Schema::hasColumn('managed_documents', 'document_type')) {
                    $table->string('document_type', 64)->nullable()->after('module');
                    $table->string('archive_class', 32)->default('hot')->after('document_type');
                    $table->string('archive_status', 32)->default('active');
                    $table->string('disposal_status', 32)->nullable();
                    $table->string('physical_barcode', 128)->nullable();
                    $table->string('physical_location', 255)->nullable();
                    $table->boolean('has_physical_original')->default(false);
                    $table->text('search_text')->nullable();
                    $table->index(['tenant_id', 'document_type']);
                    $table->index(['tenant_id', 'archive_status']);
                    $table->index('physical_barcode');
                }
            });
        }

        if (! Schema::hasTable('document_file_objects')) {
            Schema::create('document_file_objects', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->string('content_hash', 64);
                $table->string('storage_disk', 32)->default('local');
                $table->string('storage_path');
                $table->string('mime_type')->nullable();
                $table->unsignedBigInteger('size_bytes')->nullable();
                $table->string('quarantine_status', 16)->default('pending');
                $table->timestamp('scanned_at')->nullable();
                $table->string('scan_provider', 64)->nullable();
                $table->text('scan_summary')->nullable();
                $table->unsignedInteger('ref_count')->default(0);
                $table->timestamps();
                $table->unique(['tenant_id', 'content_hash']);
                $table->index(['tenant_id', 'quarantine_status']);
            });
        }

        if (Schema::hasTable('document_versions') && ! Schema::hasColumn('document_versions', 'file_object_id')) {
            Schema::table('document_versions', function (Blueprint $table) {
                $table->unsignedBigInteger('file_object_id')->nullable()->after('managed_document_id');
                $table->boolean('is_derivative')->default(false)->after('notes');
                $table->unsignedBigInteger('derivative_of_version_id')->nullable()->after('is_derivative');
                $table->string('derivative_kind', 32)->nullable()->after('derivative_of_version_id');
                $table->text('quarantine_reason')->nullable()->after('scan_provider');
                $table->index('file_object_id');
            });
        }

        if (! Schema::hasTable('document_links')) {
            Schema::create('document_links', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('managed_document_id')->constrained('managed_documents')->cascadeOnDelete();
                $table->unsignedBigInteger('document_version_id')->nullable();
                $table->string('linkable_type');
                $table->unsignedBigInteger('linkable_id');
                $table->string('role', 64)->nullable();
                $table->string('label')->nullable();
                $table->foreignId('linked_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('unlinked_at')->nullable();
                $table->foreignId('unlinked_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->index(['linkable_type', 'linkable_id']);
                $table->index(['tenant_id', 'managed_document_id']);
            });
        }

        if (! Schema::hasTable('document_upload_sessions')) {
            Schema::create('document_upload_sessions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
                $table->uuid('session_uuid')->unique();
                $table->string('original_filename');
                $table->string('mime_type')->nullable();
                $table->unsignedBigInteger('declared_size')->nullable();
                $table->unsignedInteger('chunk_size')->default(1048576);
                $table->unsignedInteger('total_chunks')->nullable();
                $table->unsignedInteger('received_chunks')->default(0);
                $table->string('temp_path')->nullable();
                $table->string('status', 16)->default('initiated');
                $table->json('meta')->nullable();
                $table->timestamp('expires_at');
                $table->timestamps();
                $table->index(['tenant_id', 'status']);
            });
        }

        if (! Schema::hasTable('document_external_shares')) {
            Schema::create('document_external_shares', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('document_version_id')->constrained('document_versions')->cascadeOnDelete();
                $table->string('token_hash', 64)->unique();
                $table->string('recipient_email')->nullable();
                $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
                $table->timestamp('expires_at');
                $table->unsignedSmallInteger('max_uses')->default(1);
                $table->unsignedSmallInteger('use_count')->default(0);
                $table->boolean('watermark')->default(true);
                $table->timestamp('revoked_at')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('document_derivatives')) {
            Schema::create('document_derivatives', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('source_version_id')->constrained('document_versions')->cascadeOnDelete();
                $table->foreignId('derivative_version_id')->nullable()->constrained('document_versions')->nullOnDelete();
                $table->string('kind', 32);
                $table->string('status', 16)->default('pending');
                $table->json('payload')->nullable();
                $table->timestamps();
                $table->index(['source_version_id', 'kind']);
            });
        }

        if (! Schema::hasTable('document_ocr_jobs')) {
            Schema::create('document_ocr_jobs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('document_version_id')->constrained('document_versions')->cascadeOnDelete();
                $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('driver', 32)->default('null');
                $table->string('status', 16)->default('queued');
                $table->text('extracted_text')->nullable();
                $table->text('error_message')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('document_retention_campaigns')) {
            Schema::create('document_retention_campaigns', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->string('name');
                $table->string('status', 16)->default('draft');
                $table->date('cutoff_date')->nullable();
                $table->unsignedInteger('candidate_count')->default(0);
                $table->unsignedInteger('held_count')->default(0);
                $table->unsignedInteger('disposed_count')->default(0);
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->json('filters')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('document_disposal_requests')) {
            Schema::create('document_disposal_requests', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('managed_document_id')->constrained('managed_documents')->cascadeOnDelete();
                $table->foreignId('requested_by')->constrained('users')->cascadeOnDelete();
                $table->string('status', 16)->default('pending');
                $table->text('reason')->nullable();
                $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('decided_at')->nullable();
                $table->text('decision_notes')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('document_governance_decisions')) {
            Schema::create('document_governance_decisions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->string('decision_key', 64);
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->string('title');
                $table->text('description')->nullable();
                $table->string('status', 32)->default('pending');
                $table->text('decision_notes')->nullable();
                $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('decided_at')->nullable();
                $table->timestamps();
                $table->unique(['tenant_id', 'decision_key']);
            });
        }

        if (Schema::hasTable('correspondence') && ! Schema::hasColumn('correspondence', 'managed_document_id')) {
            Schema::table('correspondence', function (Blueprint $table) {
                if (! Schema::hasColumn('correspondence', 'content_hash')) {
                    $table->string('content_hash', 64)->nullable()->after('size_bytes');
                }
                $table->unsignedBigInteger('managed_document_id')->nullable()->after('content_hash');
                $table->unsignedBigInteger('document_version_id')->nullable()->after('managed_document_id');
                $table->index('managed_document_id');
            });
        }

        if (Schema::hasTable('audit_workpapers') && ! Schema::hasColumn('audit_workpapers', 'managed_document_id')) {
            Schema::table('audit_workpapers', function (Blueprint $table) {
                $table->string('storage_path')->nullable()->after('confidentiality_level');
                $table->string('original_filename')->nullable();
                $table->string('mime_type')->nullable();
                $table->unsignedBigInteger('size_bytes')->nullable();
                $table->string('content_hash', 64)->nullable();
                $table->unsignedBigInteger('managed_document_id')->nullable();
                $table->unsignedBigInteger('document_version_id')->nullable();
                $table->index('managed_document_id');
            });
        }

        if (Schema::hasTable('audit_evidence_responses') && ! Schema::hasColumn('audit_evidence_responses', 'managed_document_id')) {
            Schema::table('audit_evidence_responses', function (Blueprint $table) {
                $table->string('content_hash', 64)->nullable()->after('attachment_path');
                $table->unsignedBigInteger('managed_document_id')->nullable();
                $table->unsignedBigInteger('document_version_id')->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('document_governance_decisions');
        Schema::dropIfExists('document_disposal_requests');
        Schema::dropIfExists('document_retention_campaigns');
        Schema::dropIfExists('document_ocr_jobs');
        Schema::dropIfExists('document_derivatives');
        Schema::dropIfExists('document_external_shares');
        Schema::dropIfExists('document_upload_sessions');
        Schema::dropIfExists('document_links');

        if (Schema::hasTable('document_versions') && Schema::hasColumn('document_versions', 'file_object_id')) {
            Schema::table('document_versions', function (Blueprint $table) {
                $table->dropColumn([
                    'file_object_id', 'is_derivative', 'derivative_of_version_id',
                    'derivative_kind', 'quarantine_reason',
                ]);
            });
        }

        Schema::dropIfExists('document_file_objects');
    }
};
