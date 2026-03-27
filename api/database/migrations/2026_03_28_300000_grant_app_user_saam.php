<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $tables = [
            'signature_profiles'  => 'signature_profiles_id_seq',
            'signature_versions'  => 'signature_versions_id_seq',
            'signature_events'    => 'signature_events_id_seq',
            'delegated_authorities' => 'delegated_authorities_id_seq',
            'signed_documents'    => 'signed_documents_id_seq',
        ];

        foreach ($tables as $table => $seq) {
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {$table} TO app_user");
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$seq} TO app_user");
        }
    }

    public function down(): void
    {
        // Grants are not reversible in this context
    }
};
