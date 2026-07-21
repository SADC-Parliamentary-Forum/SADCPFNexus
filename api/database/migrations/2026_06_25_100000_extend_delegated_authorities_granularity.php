<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * WS1 — Delegation granularity (PRD §6.2, §7.1, §7.2, §28.1).
 *
 * Adds module coverage, action-scope flags and a principal-confirmation
 * requirement to admin-configured delegated authorities. This NEVER grants
 * a "login as" capability — it only records what a delegate is permitted to
 * prepare/submit/upload/act-on-behalf-of for a principal within a window.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('delegated_authorities', function (Blueprint $table) {
            // Which module this delegation covers (null = any / general, kept
            // backward-compatible with the legacy role_scope string).
            $table->string('module', 64)->nullable()->after('role_scope');

            // Granular action scope flags.
            $table->boolean('can_draft')->default(true)->after('module');
            $table->boolean('can_submit')->default(true)->after('can_draft');
            $table->boolean('can_upload')->default(true)->after('can_submit');
            $table->boolean('can_act_on_behalf')->default(false)->after('can_upload');

            // When true, actions taken under this delegation require explicit
            // principal confirmation before they take effect downstream.
            $table->boolean('requires_principal_confirmation')->default(false)->after('can_act_on_behalf');

            // Lifecycle bookkeeping so we can fire "activated/expired" triggers
            // idempotently from a scheduled sweep.
            $table->timestamp('activated_notified_at')->nullable()->after('requires_principal_confirmation');
            $table->timestamp('expired_notified_at')->nullable()->after('activated_notified_at');

            $table->index(['tenant_id', 'delegate_user_id', 'module']);
        });
    }

    public function down(): void
    {
        Schema::table('delegated_authorities', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'delegate_user_id', 'module']);
            $table->dropColumn([
                'module',
                'can_draft',
                'can_submit',
                'can_upload',
                'can_act_on_behalf',
                'requires_principal_confirmation',
                'activated_notified_at',
                'expired_notified_at',
            ]);
        });
    }
};
