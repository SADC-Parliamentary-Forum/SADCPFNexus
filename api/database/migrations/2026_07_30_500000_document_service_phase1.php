<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('managed_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('owner_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->string('module', 64)->default('general');
            $table->string('subject_type')->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->unsignedBigInteger('current_version_id')->nullable();
            $table->boolean('is_final')->default(false);
            $table->string('classification', 32)->default('UNCLASSIFIED');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'module']);
            $table->index(['subject_type', 'subject_id']);
        });

        Schema::create('document_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('managed_document_id')->constrained('managed_documents')->cascadeOnDelete();
            $table->unsignedInteger('version_number');
            $table->string('content_hash', 64);
            $table->string('storage_disk', 32)->default('local');
            $table->string('storage_path');
            $table->string('original_filename');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->string('quarantine_status', 16)->default('pending');
            $table->timestamp('scanned_at')->nullable();
            $table->string('scan_provider', 64)->nullable();
            $table->string('status', 16)->default('active'); // active|immutable|final
            $table->boolean('is_immutable')->default(false);
            $table->foreignId('uploaded_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('finalized_at')->nullable();
            $table->foreignId('finalized_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('signed_locked_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['managed_document_id', 'version_number']);
            $table->index(['tenant_id', 'content_hash']);
            $table->index(['managed_document_id', 'status']);
        });

        Schema::table('managed_documents', function (Blueprint $table) {
            $table->foreign('current_version_id')
                ->references('id')
                ->on('document_versions')
                ->nullOnDelete();
        });

        Schema::create('document_download_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('document_version_id')->constrained('document_versions')->cascadeOnDelete();
            $table->string('token_hash', 64);
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('expires_at');
            $table->unsignedSmallInteger('max_uses')->default(1);
            $table->unsignedSmallInteger('use_count')->default(0);
            $table->timestamp('used_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->unique('token_hash');
            $table->index(['document_version_id', 'expires_at']);
        });

        Schema::create('document_audit_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('managed_document_id')->nullable()->constrained('managed_documents')->nullOnDelete();
            $table->foreignId('document_version_id')->nullable()->constrained('document_versions')->nullOnDelete();
            $table->string('event_type', 64);
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('payload')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index(['tenant_id', 'event_type']);
            $table->index(['managed_document_id', 'occurred_at']);
        });

        if (Schema::hasTable('attachments') && ! Schema::hasColumn('attachments', 'content_hash')) {
            Schema::table('attachments', function (Blueprint $table) {
                $table->string('content_hash', 64)->nullable()->after('size_bytes');
                $table->unsignedBigInteger('managed_document_id')->nullable()->after('content_hash');
                $table->unsignedBigInteger('document_version_id')->nullable()->after('managed_document_id');
                $table->index('content_hash');
            });
        }

        if (Schema::hasTable('person_documents') && ! Schema::hasColumn('person_documents', 'content_hash')) {
            Schema::table('person_documents', function (Blueprint $table) {
                $table->string('content_hash', 64)->nullable()->after('storage_path');
                $table->unsignedBigInteger('managed_document_id')->nullable()->after('content_hash');
                $table->unsignedBigInteger('document_version_id')->nullable()->after('managed_document_id');
                $table->boolean('is_immutable')->default(false)->after('document_version_id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('person_documents') && Schema::hasColumn('person_documents', 'content_hash')) {
            Schema::table('person_documents', function (Blueprint $table) {
                $table->dropColumn(['content_hash', 'managed_document_id', 'document_version_id', 'is_immutable']);
            });
        }

        if (Schema::hasTable('attachments') && Schema::hasColumn('attachments', 'content_hash')) {
            Schema::table('attachments', function (Blueprint $table) {
                $table->dropColumn(['content_hash', 'managed_document_id', 'document_version_id']);
            });
        }

        Schema::dropIfExists('document_audit_events');
        Schema::dropIfExists('document_download_tokens');

        Schema::table('managed_documents', function (Blueprint $table) {
            $table->dropForeign(['current_version_id']);
        });

        Schema::dropIfExists('document_versions');
        Schema::dropIfExists('managed_documents');
    }
};
