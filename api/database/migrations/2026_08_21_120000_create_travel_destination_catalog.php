<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('travel_destination_countries')) {
            Schema::create('travel_destination_countries', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->string('name', 100);
                $table->boolean('is_sadc')->default(false);
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->unique(['tenant_id', 'name']);
                $table->index(['tenant_id', 'is_sadc']);
            });
        }

        if (! Schema::hasTable('travel_destination_cities')) {
            Schema::create('travel_destination_cities', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('country_id')->constrained('travel_destination_countries')->cascadeOnDelete();
                $table->string('name', 100);
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->unique(['tenant_id', 'country_id', 'name']);
            });
        }

        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        foreach (['travel_destination_countries', 'travel_destination_cities'] as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            try {
                DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {$table} TO app_user");
                DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
            } catch (\Throwable) {
                // Local PHPUnit roles may not include app_user.
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('travel_destination_cities');
        Schema::dropIfExists('travel_destination_countries');
    }
};
