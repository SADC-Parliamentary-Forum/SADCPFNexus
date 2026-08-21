<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('travel_itineraries', function (Blueprint $table) {
            if (! Schema::hasColumn('travel_itineraries', 'flight_name')) {
                $table->string('flight_name', 120)->nullable()->after('transport_mode');
            }
            if (! Schema::hasColumn('travel_itineraries', 'flight_number')) {
                $table->string('flight_number', 32)->nullable()->after('flight_name');
            }
        });

        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        if (! Schema::hasTable('travel_itineraries')) {
            return;
        }

        try {
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE travel_itineraries TO app_user');
            DB::statement('GRANT USAGE, SELECT ON SEQUENCE travel_itineraries_id_seq TO app_user');
        } catch (\Throwable) {
            // Local PHPUnit roles may not include app_user.
        }
    }

    public function down(): void
    {
        Schema::table('travel_itineraries', function (Blueprint $table) {
            if (Schema::hasColumn('travel_itineraries', 'flight_name')) {
                $table->dropColumn('flight_name');
            }
        });
    }
};
