<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leave_policy_versions', function (Blueprint $table) {
            $table->string('workflow_mode', 40)->default('standard')->after('rules');
            $table->boolean('admin_review_required')->default(false)->after('workflow_mode');
            $table->string('principal_role', 80)->default('Director')->after('admin_review_required');
            $table->string('final_approver_role', 80)->default('Secretary General')->after('principal_role');
        });

        Schema::table('assignments', function (Blueprint $table) {
            $table->string('google_calendar_event_id')->nullable()->after('source_reference');
            $table->string('google_calendar_etag')->nullable()->after('google_calendar_event_id');
            $table->timestamp('google_calendar_synced_at')->nullable()->after('google_calendar_etag');
            $table->index(['tenant_id', 'google_calendar_event_id'], 'assignments_tenant_gcal_event_idx');
        });

        Schema::create('google_calendar_connections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('calendar_id')->default('primary');
            $table->text('refresh_token_encrypted')->nullable();
            $table->text('access_token_encrypted')->nullable();
            $table->timestamp('token_expires_at')->nullable();
            $table->string('sync_token')->nullable();
            $table->string('channel_id')->nullable();
            $table->string('resource_id')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'calendar_id']);
        });

        Schema::create('google_calendar_webhook_receipts', function (Blueprint $table) {
            $table->id();
            $table->string('channel_id');
            $table->string('resource_id')->nullable();
            $table->string('message_number');
            $table->timestamp('processed_at');
            $table->timestamps();
            $table->unique(['channel_id', 'message_number'], 'gcal_webhook_channel_msg_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('google_calendar_webhook_receipts');
        Schema::dropIfExists('google_calendar_connections');

        Schema::table('assignments', function (Blueprint $table) {
            $table->dropIndex('assignments_tenant_gcal_event_idx');
            $table->dropColumn(['google_calendar_event_id', 'google_calendar_etag', 'google_calendar_synced_at']);
        });

        Schema::table('leave_policy_versions', function (Blueprint $table) {
            $table->dropColumn(['workflow_mode', 'admin_review_required', 'principal_role', 'final_approver_role']);
        });
    }
};
