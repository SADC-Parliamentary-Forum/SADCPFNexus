<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Platform Audit Trail Phase 1 — append-only event store (NOT Internal Audit module).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_event_types', function (Blueprint $table) {
            $table->id();
            $table->string('event_key', 128)->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('category', 64);
            $table->string('severity', 32)->default('informational');
            $table->json('required_fields')->nullable();
            $table->json('optional_fields')->nullable();
            $table->json('sensitive_fields')->nullable();
            $table->boolean('actor_required')->default(true);
            $table->boolean('subject_required')->default(false);
            $table->string('retention_class', 64)->default('standard');
            $table->string('alert_policy', 64)->nullable();
            $table->string('user_visible_label')->nullable();
            $table->unsignedSmallInteger('effective_version')->default(1);
            $table->string('status', 32)->default('active'); // active|deprecated|draft
            $table->timestamps();

            $table->index(['category', 'status']);
        });

        Schema::create('audit_event_schema_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('audit_event_type_id')->constrained('audit_event_types')->cascadeOnDelete();
            $table->unsignedSmallInteger('schema_version');
            $table->string('producer_version', 64)->nullable();
            $table->json('payload_schema')->nullable();
            $table->text('change_notes')->nullable();
            $table->timestamp('effective_from')->nullable();
            $table->timestamps();

            $table->unique(['audit_event_type_id', 'schema_version'], 'audit_schema_type_version_uq');
        });

        Schema::create('audit_events', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('sequence_number');
            $table->foreignId('event_type_id')->nullable()->constrained('audit_event_types')->nullOnDelete();
            $table->string('event_key', 128);
            $table->unsignedSmallInteger('schema_version')->default(1);
            $table->string('producer_version', 64)->nullable();
            $table->string('category', 64);
            $table->string('severity', 32)->default('informational');
            $table->string('outcome', 32)->default('success');
            $table->timestamp('occurred_at');
            $table->timestamp('received_at');
            $table->string('actor_type', 32)->default('human'); // human|service|anonymous
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->json('actor_snapshot')->nullable();
            $table->unsignedBigInteger('principal_id')->nullable();
            $table->unsignedBigInteger('delegation_id')->nullable();
            $table->unsignedBigInteger('acting_appointment_id')->nullable();
            $table->string('subject_type')->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->json('subject_snapshot')->nullable();
            $table->string('source_module', 64)->nullable();
            $table->string('action', 128)->nullable();
            $table->text('reason')->nullable();
            $table->uuid('correlation_id')->nullable();
            $table->uuid('causation_event_id')->nullable();
            $table->string('request_id', 64)->nullable();
            $table->string('session_reference', 128)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->string('channel', 32)->nullable();
            $table->json('payload')->nullable();
            $table->string('previous_event_hash', 64)->nullable();
            $table->string('event_hash', 64);
            $table->unsignedBigInteger('checkpoint_id')->nullable();
            $table->string('retention_class', 64)->default('standard');
            $table->string('confidentiality', 32)->default('internal');
            $table->string('idempotency_key', 191)->nullable();
            $table->string('migration_status', 64)->nullable(); // Migrated-Complete|Migrated-Partial|Migrated-Unmapped|null for native
            $table->unsignedBigInteger('legacy_audit_log_id')->nullable();
            $table->timestamp('created_at')->useCurrent();
            // NO updated_at — append-only

            $table->unique(['tenant_id', 'sequence_number']);
            $table->unique(['tenant_id', 'idempotency_key']);
            $table->index(['tenant_id', 'occurred_at']);
            $table->index(['tenant_id', 'event_key']);
            $table->index(['tenant_id', 'category']);
            $table->index(['subject_type', 'subject_id']);
            $table->index(['actor_id', 'occurred_at']);
            $table->index(['correlation_id']);
            $table->index(['legacy_audit_log_id']);
        });

        Schema::create('audit_event_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('audit_event_id')->constrained('audit_events')->cascadeOnDelete();
            $table->string('field_name', 128);
            $table->string('field_label')->nullable();
            $table->string('data_classification', 32)->default('internal');
            $table->text('old_value')->nullable();
            $table->text('new_value')->nullable();
            $table->string('old_value_hash', 64)->nullable();
            $table->string('new_value_hash', 64)->nullable();
            $table->string('redaction_type', 32)->nullable(); // none|masked|excluded|hashed_only
            $table->string('change_reason')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['audit_event_id', 'field_name']);
        });

        Schema::create('audit_event_actors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('audit_event_id')->constrained('audit_events')->cascadeOnDelete();
            $table->unsignedBigInteger('person_id')->nullable();
            $table->unsignedBigInteger('account_id')->nullable();
            $table->string('display_name')->nullable();
            $table->string('employee_number', 64)->nullable();
            $table->unsignedBigInteger('position_id')->nullable();
            $table->string('position_title')->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->string('department_name')->nullable();
            $table->json('roles_used')->nullable();
            $table->unsignedBigInteger('authority_id')->nullable();
            $table->string('authority_scope')->nullable();
            $table->string('delegation_reference')->nullable();
            $table->string('acting_reference')->nullable();
            $table->string('authentication_strength', 64)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->unique('audit_event_id');
        });

        Schema::create('audit_event_subjects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('audit_event_id')->constrained('audit_events')->cascadeOnDelete();
            $table->string('subject_type');
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('business_reference')->nullable();
            $table->string('display_label')->nullable();
            $table->json('snapshot')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->unique('audit_event_id');
            $table->index(['subject_type', 'subject_id']);
        });

        Schema::create('audit_event_contexts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('audit_event_id')->constrained('audit_events')->cascadeOnDelete();
            $table->string('request_id', 64)->nullable();
            $table->string('session_reference', 128)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->string('channel', 32)->nullable();
            $table->string('url')->nullable();
            $table->json('extra')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->unique('audit_event_id');
        });

        Schema::create('audit_event_authority_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('audit_event_id')->constrained('audit_events')->cascadeOnDelete();
            $table->json('roles')->nullable();
            $table->json('permissions_used')->nullable();
            $table->json('authority_grants')->nullable();
            $table->json('delegation')->nullable();
            $table->json('acting_appointment')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->unique('audit_event_id');
        });

        Schema::create('audit_event_integrity_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('audit_event_id')->constrained('audit_events')->cascadeOnDelete();
            $table->string('canonical_payload_hash', 64);
            $table->string('previous_hash', 64)->nullable();
            $table->string('event_hash', 64);
            $table->string('algorithm', 32)->default('sha256');
            $table->string('key_reference', 128)->nullable();
            $table->string('verification_status', 32)->default('pending');
            $table->timestamp('verified_at')->nullable();
            $table->unsignedBigInteger('checkpoint_id')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->unique('audit_event_id');
        });

        Schema::create('audit_event_checkpoints', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->uuid('uuid')->unique();
            $table->unsignedBigInteger('from_sequence');
            $table->unsignedBigInteger('to_sequence');
            $table->unsignedBigInteger('event_count');
            $table->string('chain_root_hash', 64);
            $table->string('chain_tip_hash', 64);
            $table->string('checkpoint_hash', 64);
            $table->string('algorithm', 32)->default('sha256');
            $table->string('status', 32)->default('valid'); // valid|failed|pending
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['tenant_id', 'created_at']);
        });

        Schema::table('audit_events', function (Blueprint $table) {
            $table->foreign('checkpoint_id')
                ->references('id')
                ->on('audit_event_checkpoints')
                ->nullOnDelete();
        });

        Schema::create('audit_event_outbox', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->uuid('event_uuid')->unique();
            $table->string('idempotency_key', 191)->nullable();
            $table->string('event_key', 128);
            $table->json('payload');
            $table->string('status', 32)->default('pending'); // pending|processing|committed|failed|dead_lettered
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->text('last_error')->nullable();
            $table->timestamp('available_at')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status', 'available_at']);
            $table->unique(['tenant_id', 'idempotency_key']);
        });

        Schema::create('audit_event_dead_letters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->uuid('event_uuid')->nullable();
            $table->unsignedBigInteger('outbox_id')->nullable();
            $table->string('event_key', 128)->nullable();
            $table->json('payload')->nullable();
            $table->text('error_message');
            $table->string('status', 32)->default('open'); // open|replayed|discarded_pending_approval
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
        });

        Schema::create('audit_event_holds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->uuid('uuid')->unique();
            $table->string('hold_type', 32); // legal|audit|investigation
            $table->string('scope_type', 64); // event|subject|category|tenant
            $table->string('scope_value')->nullable();
            $table->unsignedBigInteger('audit_event_id')->nullable();
            $table->string('reason');
            $table->string('status', 32)->default('active'); // active|released
            $table->foreignId('placed_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('placed_at');
            $table->foreignId('released_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('released_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->index(['audit_event_id']);
        });

        Schema::create('audit_event_access_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('viewer_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('access_type', 64); // search|view|export|integrity_verify|record_history
            $table->string('purpose')->nullable();
            $table->json('filters')->nullable();
            $table->unsignedBigInteger('target_event_id')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('accessed_at');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['tenant_id', 'accessed_at']);
            $table->index(['viewer_user_id', 'accessed_at']);
        });

        Schema::create('audit_trail_governance_decisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('decision_key', 64);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('status', 32)->default('pending'); // pending|decided|not_applicable
            $table->text('decision_notes')->nullable();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'decision_key']);
            $table->index(['tenant_id', 'status']);
        });

        // Phase 2 stubs (governance-only readiness)
        Schema::create('audit_event_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference', 64)->unique();
            $table->string('severity', 32)->default('medium');
            $table->unsignedBigInteger('first_event_id')->nullable();
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('status', 32)->default('open');
            $table->string('conclusion')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('detected_at');
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
        });

        Schema::create('forensic_cases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->uuid('uuid')->unique();
            $table->string('reference', 64);
            $table->string('title');
            $table->string('status', 32)->default('draft'); // draft|open|closed — Phase 2
            $table->foreignId('opened_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'reference']);
        });

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('CREATE OR REPLACE RULE audit_events_no_update AS ON UPDATE TO audit_events DO INSTEAD NOTHING;');
            DB::statement('CREATE OR REPLACE RULE audit_events_no_delete AS ON DELETE TO audit_events DO INSTEAD NOTHING;');
            DB::statement('CREATE OR REPLACE RULE audit_event_changes_no_update AS ON UPDATE TO audit_event_changes DO INSTEAD NOTHING;');
            DB::statement('CREATE OR REPLACE RULE audit_event_changes_no_delete AS ON DELETE TO audit_event_changes DO INSTEAD NOTHING;');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('forensic_cases');
        Schema::dropIfExists('audit_event_alerts');
        Schema::dropIfExists('audit_trail_governance_decisions');
        Schema::dropIfExists('audit_event_access_logs');
        Schema::dropIfExists('audit_event_holds');
        Schema::dropIfExists('audit_event_dead_letters');
        Schema::dropIfExists('audit_event_outbox');

        Schema::table('audit_events', function (Blueprint $table) {
            $table->dropForeign(['checkpoint_id']);
        });

        Schema::dropIfExists('audit_event_checkpoints');
        Schema::dropIfExists('audit_event_integrity_records');
        Schema::dropIfExists('audit_event_authority_snapshots');
        Schema::dropIfExists('audit_event_contexts');
        Schema::dropIfExists('audit_event_subjects');
        Schema::dropIfExists('audit_event_actors');
        Schema::dropIfExists('audit_event_changes');
        Schema::dropIfExists('audit_events');
        Schema::dropIfExists('audit_event_schema_versions');
        Schema::dropIfExists('audit_event_types');
    }
};
