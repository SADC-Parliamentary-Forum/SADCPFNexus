<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Allow outbox deliveries to external (non-user) email addresses —
 * procurement vendor contacts, correspondence contacts, RFQ invites.
 *
 * Fresh installs already get nullable user_id + external_* from the Phase 1 create
 * migration; this alter is for environments that ran the earlier Phase 1 schema.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('notification_recipients')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();
        $needsExternal = ! Schema::hasColumn('notification_recipients', 'external_email');

        if ($needsExternal) {
            Schema::table('notification_recipients', function (Blueprint $table) {
                $table->string('external_email', 191)->nullable()->after('user_id');
                $table->string('external_name', 191)->nullable()->after('external_email');
            });
        }

        if ($driver !== 'pgsql') {
            return;
        }

        // Make user_id nullable and switch to partial uniques (prod Path already may have them).
        DB::statement('ALTER TABLE notification_recipients DROP CONSTRAINT IF EXISTS notification_recipients_user_id_foreign');
        DB::statement('ALTER TABLE notification_recipients DROP CONSTRAINT IF EXISTS notification_recipients_record_user_unique');
        DB::statement('ALTER TABLE notification_recipients DROP CONSTRAINT IF EXISTS notification_recipients_record_external_unique');
        DB::statement('DROP INDEX IF EXISTS notification_recipients_record_user_unique');
        DB::statement('DROP INDEX IF EXISTS notification_recipients_record_external_unique');
        DB::statement('ALTER TABLE notification_recipients ALTER COLUMN user_id DROP NOT NULL');
        DB::statement('ALTER TABLE notification_recipients ADD CONSTRAINT notification_recipients_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');
        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS notification_recipients_record_user_unique ON notification_recipients (notification_record_id, user_id) WHERE user_id IS NOT NULL');
        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS notification_recipients_record_external_unique ON notification_recipients (notification_record_id, external_email) WHERE external_email IS NOT NULL');
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notification_recipients TO app_user');
    }

    public function down(): void
    {
        // Non-destructive: keep external columns; do not re-impose NOT NULL on user_id.
    }
};
