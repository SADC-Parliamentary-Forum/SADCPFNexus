<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('device_tokens')) {
            Schema::table('device_tokens', function (Blueprint $table) {
                if (! Schema::hasColumn('device_tokens', 'revoked_at')) {
                    $table->timestamp('revoked_at')->nullable()->after('last_used_at');
                }
                if (! Schema::hasColumn('device_tokens', 'app_version')) {
                    $table->string('app_version', 64)->nullable()->after('device_name');
                }
                if (! Schema::hasColumn('device_tokens', 'push_enabled')) {
                    $table->boolean('push_enabled')->default(true)->after('platform');
                }
            });
        }

        if (Schema::hasTable('notification_channel_deliveries')) {
            Schema::table('notification_channel_deliveries', function (Blueprint $table) {
                if (! Schema::hasColumn('notification_channel_deliveries', 'failover_provider')) {
                    $table->string('failover_provider', 64)->nullable()->after('provider');
                }
                if (! Schema::hasColumn('notification_channel_deliveries', 'latency_ms')) {
                    $table->unsignedInteger('latency_ms')->nullable()->after('attempt_count');
                }
                if (! Schema::hasColumn('notification_channel_deliveries', 'bounce_class')) {
                    $table->string('bounce_class', 32)->nullable()->after('failure_code');
                }
                if (! Schema::hasColumn('notification_channel_deliveries', 'coalesce_bucket_id')) {
                    $table->unsignedBigInteger('coalesce_bucket_id')->nullable()->index()->after('recipient_id');
                }
            });
        }

        if (Schema::hasTable('notification_digests')) {
            Schema::table('notification_digests', function (Blueprint $table) {
                if (! Schema::hasColumn('notification_digests', 'ai_summary')) {
                    $table->text('ai_summary')->nullable()->after('status');
                }
                if (! Schema::hasColumn('notification_digests', 'ai_summary_provider')) {
                    $table->string('ai_summary_provider', 32)->nullable()->after('ai_summary');
                }
            });
        }

        if (Schema::hasTable('notification_policies')) {
            Schema::table('notification_policies', function (Blueprint $table) {
                if (! Schema::hasColumn('notification_policies', 'sms_enabled')) {
                    $table->boolean('sms_enabled')->default(false)->after('push_enabled');
                }
                if (! Schema::hasColumn('notification_policies', 'whatsapp_enabled')) {
                    $table->boolean('whatsapp_enabled')->default(false)->after('sms_enabled');
                }
            });
        }

        Schema::create('notification_ack_campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->uuid('uuid')->unique();
            $table->string('title', 255);
            $table->text('body');
            $table->string('importance', 32)->default('high');
            $table->boolean('required')->default(true);
            $table->timestamp('deadline_at')->nullable();
            $table->jsonb('reminder_offsets_hours')->nullable();
            $table->jsonb('escalation_policy')->nullable();
            $table->jsonb('audience')->nullable();
            $table->string('secure_route', 512)->nullable();
            $table->string('status', 32)->default('draft'); // draft|active|closed|cancelled
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('notification_ack_recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('campaign_id')->constrained('notification_ack_campaigns')->cascadeOnDelete();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('notification_id')->nullable();
            $table->string('status', 32)->default('pending'); // pending|acknowledged|overdue|escalated
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamp('last_reminded_at')->nullable();
            $table->unsignedInteger('reminder_count')->default(0);
            $table->timestamp('escalated_at')->nullable();
            $table->timestamps();
            $table->unique(['campaign_id', 'user_id'], 'notif_ack_campaign_user_unique');
        });

        Schema::create('notification_broadcasts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->uuid('uuid')->unique();
            $table->string('title', 255);
            $table->text('body');
            $table->string('impact', 32)->default('normal'); // normal|high|critical
            $table->string('broadcast_type', 64)->default('general'); // general|maintenance
            $table->jsonb('audience')->nullable();
            $table->string('status', 32)->default('draft'); // draft|submitted|approved|sending|sent|cancelled
            $table->unsignedBigInteger('created_by');
            $table->unsignedBigInteger('submitted_by')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->string('idempotency_key', 191)->nullable();
            $table->text('cancel_reason')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'idempotency_key'], 'notif_broadcast_tenant_idem_unique');
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('notification_coalesce_buckets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->unsignedBigInteger('user_id');
            $table->string('coalesce_key', 191);
            $table->string('status', 32)->default('open'); // open|flushed|cancelled
            $table->boolean('critical')->default(false);
            $table->timestamp('window_starts_at');
            $table->timestamp('window_ends_at');
            $table->timestamp('flushed_at')->nullable();
            $table->unsignedBigInteger('flushed_notification_id')->nullable();
            $table->timestamps();
            $table->index(['status', 'window_ends_at']);
            $table->index(['tenant_id', 'user_id', 'coalesce_key', 'status'], 'notif_coalesce_open_idx');
        });

        Schema::create('notification_coalesce_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bucket_id')->constrained('notification_coalesce_buckets')->cascadeOnDelete();
            $table->string('event_key', 128);
            $table->string('summary', 500);
            $table->jsonb('payload')->nullable();
            $table->timestamps();
        });

        Schema::create('notification_external_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->uuid('uuid')->unique();
            $table->string('token_hash', 128)->unique();
            $table->string('recipient_email', 255)->nullable();
            $table->string('recipient_name', 255)->nullable();
            $table->string('subject', 255);
            $table->text('minimal_body');
            $table->string('secure_route', 512)->nullable();
            $table->string('source_module', 64)->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('viewed_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
            $table->index(['expires_at', 'revoked_at']);
        });

        Schema::create('notification_maintenance_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->uuid('uuid')->unique();
            $table->foreignId('broadcast_id')->nullable()->constrained('notification_broadcasts')->nullOnDelete();
            $table->string('title', 255);
            $table->text('body');
            $table->timestamp('starts_at');
            $table->timestamp('ends_at')->nullable();
            $table->timestamp('revalidate_at')->nullable();
            $table->string('status', 32)->default('scheduled'); // scheduled|active|expired|cancelled
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'status', 'starts_at']);
        });

        Schema::create('notification_reminders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('source_type', 64); // ack_campaign|policy|broadcast|maintenance
            $table->unsignedBigInteger('source_id');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('event_key', 128);
            $table->timestamp('due_at');
            $table->string('calendar_code', 64)->nullable();
            $table->string('status', 32)->default('pending'); // pending|sent|cancelled|skipped
            $table->timestamp('sent_at')->nullable();
            $table->jsonb('payload')->nullable();
            $table->timestamps();
            $table->index(['status', 'due_at']);
        });

        Schema::create('notification_ai_suggestions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('kind', 64); // digest_summary|preference_opt|fatigue|channel_predict|nl_search
            $table->jsonb('suggestion');
            $table->string('status', 32)->default('pending'); // pending|accepted|rejected|expired
            $table->boolean('human_confirmed')->default(false);
            $table->unsignedBigInteger('confirmed_by')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->string('provider', 32)->default('stub');
            $table->timestamps();
            $table->index(['tenant_id', 'kind', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_ai_suggestions');
        Schema::dropIfExists('notification_reminders');
        Schema::dropIfExists('notification_maintenance_alerts');
        Schema::dropIfExists('notification_external_tokens');
        Schema::dropIfExists('notification_coalesce_items');
        Schema::dropIfExists('notification_coalesce_buckets');
        Schema::dropIfExists('notification_broadcasts');
        Schema::dropIfExists('notification_ack_recipients');
        Schema::dropIfExists('notification_ack_campaigns');

        if (Schema::hasTable('notification_policies')) {
            Schema::table('notification_policies', function (Blueprint $table) {
                foreach (['whatsapp_enabled', 'sms_enabled'] as $col) {
                    if (Schema::hasColumn('notification_policies', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        if (Schema::hasTable('notification_digests')) {
            Schema::table('notification_digests', function (Blueprint $table) {
                foreach (['ai_summary_provider', 'ai_summary'] as $col) {
                    if (Schema::hasColumn('notification_digests', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        if (Schema::hasTable('notification_channel_deliveries')) {
            Schema::table('notification_channel_deliveries', function (Blueprint $table) {
                foreach (['coalesce_bucket_id', 'bounce_class', 'latency_ms', 'failover_provider'] as $col) {
                    if (Schema::hasColumn('notification_channel_deliveries', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        if (Schema::hasTable('device_tokens')) {
            Schema::table('device_tokens', function (Blueprint $table) {
                foreach (['push_enabled', 'app_version', 'revoked_at'] as $col) {
                    if (Schema::hasColumn('device_tokens', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }
    }
};
