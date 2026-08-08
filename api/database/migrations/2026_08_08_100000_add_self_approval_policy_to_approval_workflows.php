<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('approval_workflows', 'self_approval_policy')) {
            return;
        }

        Schema::table('approval_workflows', function (Blueprint $table) {
            // 'denied' (default): the requester can never approve their own
            // request at any step, no exceptions — preserves existing
            // behaviour for every currently-seeded workflow unless a
            // workflow explicitly opts into a different policy.
            // 'allow_with_controls': self-approval is permitted (typically
            // for the Secretary General acting in her institutional
            // capacity, PRD §10-11) but requires a mandatory comment and is
            // flagged in the audit trail.
            // 'require_external_approver': self-approval is blocked the
            // same as 'denied', but the denial message points admins at
            // configuring a distinct external-authority approver for the
            // final step rather than implying the request is simply stuck.
            $table->string('self_approval_policy', 30)->default('denied')->after('is_active');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('approval_workflows', 'self_approval_policy')) {
            return;
        }

        Schema::table('approval_workflows', function (Blueprint $table) {
            $table->dropColumn('self_approval_policy');
        });
    }
};
