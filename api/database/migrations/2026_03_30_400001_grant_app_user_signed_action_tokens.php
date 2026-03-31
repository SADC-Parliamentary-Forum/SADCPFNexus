<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Grant the app_user role access to the signed_action_tokens table.
        // No RLS policy is applied — the token string itself is the access control secret.
        DB::statement('GRANT SELECT, INSERT, UPDATE ON signed_action_tokens TO app_user');
        DB::statement('GRANT USAGE, SELECT ON SEQUENCE signed_action_tokens_id_seq TO app_user');
    }

    public function down(): void
    {
        DB::statement('REVOKE ALL ON signed_action_tokens FROM app_user');
        DB::statement('REVOKE ALL ON SEQUENCE signed_action_tokens_id_seq FROM app_user');
    }
};
