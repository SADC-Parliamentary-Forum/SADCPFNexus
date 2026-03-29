<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON governance_committees TO app_user');
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON governance_meeting_types TO app_user');
        DB::statement('GRANT USAGE, SELECT ON SEQUENCE governance_committees_id_seq TO app_user');
        DB::statement('GRANT USAGE, SELECT ON SEQUENCE governance_meeting_types_id_seq TO app_user');
    }

    public function down(): void
    {
        DB::statement('REVOKE ALL ON governance_committees FROM app_user');
        DB::statement('REVOKE ALL ON governance_meeting_types FROM app_user');
    }
};
