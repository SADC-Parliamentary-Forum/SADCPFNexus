<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Grant USAGE + SELECT on ALL sequences in the public schema to app_user.
 *
 * Individual table grants (SELECT/INSERT/UPDATE/DELETE) were added in earlier
 * migrations, but sequence grants were missed for most tables, causing
 * "permission denied for sequence {table}_id_seq" on INSERT.
 *
 * Using ALL SEQUENCES IN SCHEMA covers current and future sequences added
 * before this migration runs, and is idempotent (GRANT is a no-op if already
 * granted).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user');

        // Also set default privileges so sequences created in future migrations
        // are automatically accessible to app_user.
        DB::statement('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user');
    }

    public function down(): void
    {
        // Intentionally left blank — revoking sequence access breaks inserts.
    }
};
