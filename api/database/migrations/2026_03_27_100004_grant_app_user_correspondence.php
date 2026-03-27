<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $tables = [
            'correspondence',
            'correspondence_contacts',
            'contact_groups',
            'contact_group_members',
            'correspondence_recipients',
        ];

        foreach ($tables as $table) {
            if (!$this->tableExists($table)) {
                continue;
            }
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO app_user");
            if ($this->sequenceExists("{$table}_id_seq")) {
                DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
            }
        }
    }

    public function down(): void {}

    private function tableExists(string $table): bool
    {
        $result = DB::selectOne(
            "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?",
            [$table]
        );
        return (bool) $result;
    }

    private function sequenceExists(string $sequence): bool
    {
        $result = DB::selectOne(
            "SELECT 1 FROM information_schema.sequences WHERE sequence_schema = 'public' AND sequence_name = ?",
            [$sequence]
        );
        return (bool) $result;
    }
};
