<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Grant app_user permission on travel_requests and travel_itineraries sequences (required for INSERT).
     */
    public function up(): void
    {
        if ($this->sequenceExists('travel_requests_id_seq')) {
            DB::statement('GRANT USAGE, SELECT ON SEQUENCE travel_requests_id_seq TO app_user');
        }
        if ($this->sequenceExists('travel_itineraries_id_seq')) {
            DB::statement('GRANT USAGE, SELECT ON SEQUENCE travel_itineraries_id_seq TO app_user');
        }
    }

    public function down(): void
    {
        // Revoking sequence permissions requires superuser; leave as-is on rollback.
    }

    private function sequenceExists(string $name): bool
    {
        $result = DB::selectOne(
            "SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = ?",
            [$name]
        );
        return (bool) $result;
    }
};
