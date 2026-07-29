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

        if (Schema::hasTable('meeting_agenda_items')) {
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE meeting_agenda_items TO app_user');
            DB::statement('GRANT USAGE, SELECT ON SEQUENCE meeting_agenda_items_id_seq TO app_user');
        }
    }

    public function down(): void
    {
        // Grants are not revoked on down.
    }
};
