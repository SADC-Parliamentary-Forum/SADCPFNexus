<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('correspondence_mailbox_settings', function (Blueprint $table) {
            $table->string('imap_host')->nullable()->after('mailbox_address');
            $table->unsignedSmallInteger('imap_port')->nullable()->after('imap_host');
            $table->string('imap_encryption', 16)->nullable()->after('imap_port'); // ssl|tls|none
            $table->string('imap_username')->nullable()->after('imap_encryption');
            // Prefer CORRESPONDENCE_IMAP_PASSWORD env; optional encrypted DB fallback.
            $table->text('imap_password_encrypted')->nullable()->after('imap_username');
            $table->timestamp('last_polled_at')->nullable()->after('notes');
            $table->string('last_poll_status', 64)->nullable()->after('last_polled_at');
        });
    }

    public function down(): void
    {
        Schema::table('correspondence_mailbox_settings', function (Blueprint $table) {
            $table->dropColumn([
                'imap_host',
                'imap_port',
                'imap_encryption',
                'imap_username',
                'imap_password_encrypted',
                'last_polled_at',
                'last_poll_status',
            ]);
        });
    }
};
