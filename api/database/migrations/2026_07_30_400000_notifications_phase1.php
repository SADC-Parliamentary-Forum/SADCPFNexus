<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            if (! Schema::hasColumn('notifications', 'uuid')) {
                $table->uuid('uuid')->nullable()->after('id');
            }
            if (! Schema::hasColumn('notifications', 'category')) {
                $table->string('category', 64)->nullable()->after('trigger');
            }
            if (! Schema::hasColumn('notifications', 'importance')) {
                $table->string('importance', 32)->default('normal')->after('category');
            }
            if (! Schema::hasColumn('notifications', 'confidentiality')) {
                $table->string('confidentiality', 32)->default('internal')->after('importance');
            }
            if (! Schema::hasColumn('notifications', 'delivery_class')) {
                $table->string('delivery_class', 32)->default('operational')->after('confidentiality');
            }
            if (! Schema::hasColumn('notifications', 'action_required')) {
                $table->boolean('action_required')->default(false)->after('delivery_class');
            }
            if (! Schema::hasColumn('notifications', 'secure_route')) {
                $table->string('secure_route', 512)->nullable()->after('meta');
            }
            if (! Schema::hasColumn('notifications', 'acknowledged_at')) {
                $table->timestamp('acknowledged_at')->nullable()->after('read_at');
            }
            if (! Schema::hasColumn('notifications', 'archived_at')) {
                $table->timestamp('archived_at')->nullable()->after('acknowledged_at');
            }
            if (! Schema::hasColumn('notifications', 'event_id')) {
                $table->unsignedBigInteger('event_id')->nullable()->after('archived_at');
            }
            if (! Schema::hasColumn('notifications', 'template_version_id')) {
                $table->unsignedBigInteger('template_version_id')->nullable()->after('event_id');
            }
        });

        Schema::create('notification_outbox', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->uuid('uuid')->unique();
            $table->string('event_type', 128);
            $table->string('source_module', 64);
            $table->string('source_type', 128)->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('idempotency_key', 191);
            $table->string('schema_version', 16)->default('1');
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('correlation_id', 64)->nullable();
            $table->jsonb('payload');
            $table->string('status', 32)->default('pending'); // pending|processing|published|failed
            $table->unsignedInteger('attempts')->default(0);
            $table->timestamp('available_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'idempotency_key'], 'notification_outbox_tenant_idem_unique');
            $table->index(['status', 'available_at']);
        });

        Schema::create('notification_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->uuid('uuid')->unique();
            $table->unsignedBigInteger('outbox_id')->nullable();
            $table->string('event_key', 128);
            $table->string('event_type', 128);
            $table->string('source_module', 64);
            $table->string('source_type', 128)->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('source_reference_snapshot', 191)->nullable();
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->timestamp('occurred_at');
            $table->string('importance', 32)->default('normal');
            $table->string('confidentiality', 32)->default('internal');
            $table->string('correlation_id', 64)->nullable();
            $table->string('idempotency_key', 191);
            $table->jsonb('payload')->nullable();
            $table->string('status', 32)->default('consumed');
            $table->timestamps();

            $table->unique(['tenant_id', 'idempotency_key'], 'notification_events_tenant_idem_unique');
        });

        Schema::create('notification_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->uuid('uuid')->unique();
            $table->foreignId('event_id')->constrained('notification_events')->cascadeOnDelete();
            $table->string('notification_type', 128);
            $table->string('template_key', 128);
            $table->unsignedBigInteger('template_version_id')->nullable();
            $table->string('importance', 32)->default('normal');
            $table->string('confidentiality', 32)->default('internal');
            $table->string('delivery_class', 32)->default('operational');
            $table->boolean('action_required')->default(false);
            $table->string('secure_route', 512)->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->string('status', 32)->default('active');
            $table->timestamp('cancelled_at')->nullable();
            $table->unsignedBigInteger('superseded_by_id')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'notification_type']);
        });

        Schema::create('notification_recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('notification_record_id')->constrained('notification_records')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('recipient_role', 64)->nullable();
            $table->string('position_snapshot', 191)->nullable();
            $table->string('department_snapshot', 191)->nullable();
            $table->string('language', 8)->default('en');
            $table->string('time_zone', 64)->nullable();
            $table->string('resolution_reason', 191)->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->string('status', 32)->default('active');
            $table->unsignedBigInteger('in_app_notification_id')->nullable();
            $table->timestamps();

            $table->unique(['notification_record_id', 'user_id'], 'notification_recipients_record_user_unique');
        });

        Schema::create('notification_channel_deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('recipient_id')->constrained('notification_recipients')->cascadeOnDelete();
            $table->string('channel', 32); // in_app|email|push|sms|whatsapp
            $table->string('provider', 64)->nullable();
            $table->string('destination_snapshot', 191)->nullable();
            $table->unsignedBigInteger('template_version_id')->nullable();
            $table->string('rendered_subject', 512)->nullable();
            $table->string('rendered_body_hash', 64)->nullable();
            $table->string('provider_message_id', 191)->nullable();
            $table->string('queue_priority', 16)->default('normal'); // critical|normal|digest
            $table->string('status', 32)->default('pending');
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('queued_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->string('failure_code', 64)->nullable();
            $table->unsignedInteger('attempt_count')->default(0);
            $table->boolean('suppressed')->default(false);
            $table->string('suppression_reason', 191)->nullable();
            $table->timestamps();

            $table->unique(['recipient_id', 'channel'], 'notification_channel_deliveries_recipient_channel_unique');
            $table->index(['status', 'scheduled_at']);
            $table->index(['queue_priority', 'status']);
        });

        Schema::create('notification_delivery_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('channel_delivery_id')->constrained('notification_channel_deliveries')->cascadeOnDelete();
            $table->unsignedInteger('attempt_number');
            $table->timestamp('attempted_at');
            $table->string('provider_request_id', 191)->nullable();
            $table->string('result', 32);
            $table->string('response_code', 64)->nullable();
            $table->string('response_summary', 512)->nullable();
            $table->boolean('temporary_failure')->default(false);
            $table->timestamp('next_retry_at')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->timestamps();

            $table->unique(['channel_delivery_id', 'attempt_number'], 'notification_delivery_attempts_unique');
        });

        Schema::create('notification_policies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('event_key', 128);
            $table->unsignedInteger('version')->default(1);
            $table->string('status', 32)->default('published'); // draft|published|retired
            $table->string('category', 64);
            $table->string('delivery_class', 32);
            $table->string('importance', 32)->default('normal');
            $table->string('confidentiality', 32)->default('internal');
            $table->boolean('mandatory')->default(false);
            $table->boolean('digest_eligible')->default(false);
            $table->boolean('action_required')->default(false);
            $table->boolean('in_app_enabled')->default(true);
            $table->boolean('email_enabled')->default(true);
            $table->boolean('push_enabled')->default(false);
            $table->string('template_key', 128);
            $table->string('queue_priority', 16)->default('normal');
            $table->jsonb('channels')->nullable();
            $table->jsonb('reminder_policy')->nullable();
            $table->jsonb('escalation_policy')->nullable();
            $table->jsonb('retry_profile')->nullable();
            $table->timestamp('effective_from')->nullable();
            $table->timestamp('effective_to')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'event_key', 'version'], 'notification_policies_tenant_event_version_unique');
            $table->index(['tenant_id', 'event_key', 'status']);
        });

        Schema::create('notification_template_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('template_key', 128);
            $table->unsignedInteger('version')->default(1);
            $table->string('locale', 8)->default('en');
            $table->string('status', 32)->default('draft'); // draft|approved|published|retired
            $table->string('subject', 512);
            $table->text('body');
            $table->string('privacy_subject', 512)->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->unsignedBigInteger('published_by')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'template_key', 'locale', 'version'], 'notification_template_versions_unique');
            $table->index(['tenant_id', 'template_key', 'locale', 'status']);
        });

        Schema::create('notification_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('category', 64);
            $table->boolean('in_app_enabled')->default(true);
            $table->boolean('email_enabled')->default(true);
            $table->boolean('push_enabled')->default(true);
            $table->string('digest_mode', 32)->default('immediate'); // immediate|daily|weekly|off
            $table->time('quiet_hours_start')->nullable();
            $table->time('quiet_hours_end')->nullable();
            $table->string('preferred_language', 8)->default('en');
            $table->timestamps();

            $table->unique(['user_id', 'category'], 'notification_preferences_user_category_unique');
        });

        Schema::create('notification_digests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('digest_type', 16); // daily|weekly
            $table->date('period_start');
            $table->date('period_end');
            $table->string('status', 32)->default('pending');
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'digest_type', 'period_start'], 'notification_digests_user_period_unique');
        });

        Schema::create('notification_digest_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('digest_id')->constrained('notification_digests')->cascadeOnDelete();
            $table->foreignId('channel_delivery_id')->constrained('notification_channel_deliveries')->cascadeOnDelete();
            $table->string('summary', 512)->nullable();
            $table->timestamps();

            $table->unique(['digest_id', 'channel_delivery_id'], 'notification_digest_items_unique');
        });

        Schema::create('notification_suppressions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('channel', 32)->nullable();
            $table->string('destination', 191)->nullable();
            $table->string('reason', 191);
            $table->string('scope', 32)->default('temporary'); // temporary|permanent
            $table->timestamp('expires_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'destination', 'channel']);
        });

        Schema::create('notification_dead_letters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->unsignedBigInteger('channel_delivery_id')->nullable();
            $table->unsignedBigInteger('outbox_id')->nullable();
            $table->string('failure_code', 64)->nullable();
            $table->text('failure_summary')->nullable();
            $table->string('status', 32)->default('open'); // open|resolved|suppressed
            $table->unsignedBigInteger('resolved_by')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->text('resolution_notes')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
        });

        Schema::create('notification_audit_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('entity_type', 64);
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->string('action', 64);
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->jsonb('payload')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index(['tenant_id', 'entity_type', 'entity_id']);
            $table->index(['tenant_id', 'action']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_audit_events');
        Schema::dropIfExists('notification_dead_letters');
        Schema::dropIfExists('notification_suppressions');
        Schema::dropIfExists('notification_digest_items');
        Schema::dropIfExists('notification_digests');
        Schema::dropIfExists('notification_preferences');
        Schema::dropIfExists('notification_template_versions');
        Schema::dropIfExists('notification_policies');
        Schema::dropIfExists('notification_delivery_attempts');
        Schema::dropIfExists('notification_channel_deliveries');
        Schema::dropIfExists('notification_recipients');
        Schema::dropIfExists('notification_records');
        Schema::dropIfExists('notification_events');
        Schema::dropIfExists('notification_outbox');

        Schema::table('notifications', function (Blueprint $table) {
            foreach ([
                'uuid', 'category', 'importance', 'confidentiality', 'delivery_class',
                'action_required', 'secure_route', 'acknowledged_at', 'archived_at',
                'event_id', 'template_version_id',
            ] as $col) {
                if (Schema::hasColumn('notifications', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
