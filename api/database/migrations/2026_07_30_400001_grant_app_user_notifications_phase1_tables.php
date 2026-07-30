<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        $tables = [
            'notification_outbox',
            'notification_events',
            'notification_records',
            'notification_recipients',
            'notification_channel_deliveries',
            'notification_delivery_attempts',
            'notification_policies',
            'notification_template_versions',
            'notification_preferences',
            'notification_digests',
            'notification_digest_items',
            'notification_suppressions',
            'notification_dead_letters',
            'notification_audit_events',
        ];

        foreach ($tables as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {$table} TO app_user");
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
        }
    }

    public function down(): void
    {
        // Grants are not revoked on down.
    }
};
