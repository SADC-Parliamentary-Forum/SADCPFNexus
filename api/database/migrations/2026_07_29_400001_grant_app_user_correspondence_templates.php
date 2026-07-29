<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $user = config('database.connections.pgsql.app_user', env('DB_APP_USERNAME'));
        if (! $user) {
            return;
        }

        if (Schema::hasTable('correspondence_letter_templates')) {
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE correspondence_letter_templates TO "'.$user.'"');
            DB::statement('GRANT USAGE, SELECT ON SEQUENCE correspondence_letter_templates_id_seq TO "'.$user.'"');
        }
    }

    public function down(): void
    {
        // no-op
    }
};
