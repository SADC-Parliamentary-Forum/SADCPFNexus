<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON workplan_event_types TO app_user');
        DB::statement('GRANT USAGE, SELECT ON SEQUENCE workplan_event_types_id_seq TO app_user');

        DB::statement('ALTER TABLE workplan_event_types ENABLE ROW LEVEL SECURITY');

        DB::statement("
            CREATE POLICY tenant_isolation ON workplan_event_types
            USING (tenant_id = current_setting('app.tenant_id', true)::integer)
            WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::integer)
        ");
    }

    public function down(): void
    {
        DB::statement('DROP POLICY IF EXISTS tenant_isolation ON workplan_event_types');
        DB::statement('ALTER TABLE workplan_event_types DISABLE ROW LEVEL SECURITY');
        DB::statement('REVOKE ALL ON workplan_event_types FROM app_user');
    }
};
