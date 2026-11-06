<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Records when an invitation was emailed, so admins can tell "created but not invited yet"
 * apart from "invitation sent". Invitations created before this column existed were sent by
 * the web form (which always emailed), so they are backfilled with their creation time.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('account_invitations', function (Blueprint $table) {
            $table->timestamp('sent_at')->nullable()->after('expires_at');
        });

        DB::table('account_invitations')->whereNull('sent_at')->update(['sent_at' => DB::raw('created_at')]);
    }

    public function down(): void
    {
        Schema::table('account_invitations', function (Blueprint $table) {
            $table->dropColumn('sent_at');
        });
    }
};
