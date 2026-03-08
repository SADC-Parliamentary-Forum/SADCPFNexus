<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Grant app_user permission on calendar_entries_id_seq (required for INSERT).
     */
    public function up(): void
    {
        DB::statement('GRANT USAGE, SELECT ON SEQUENCE calendar_entries_id_seq TO app_user');
    }

    public function down(): void
    {
        // Revoking sequence permissions requires superuser; leave as-is on rollback.
    }
};
