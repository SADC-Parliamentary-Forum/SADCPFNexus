<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fleet_drivers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('licence_number', 64)->nullable();
            $table->date('licence_expires_on')->nullable();
            $table->string('status', 32)->default('active'); // active|inactive|suspended
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['tenant_id', 'user_id']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('fleet_bookings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnDelete();
            $table->foreignId('driver_id')->nullable()->constrained('fleet_drivers')->nullOnDelete();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            $table->string('purpose')->nullable();
            $table->string('destination')->nullable();
            $table->string('status', 32)->default('confirmed'); // confirmed|cancelled|completed
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'asset_id', 'starts_at', 'ends_at']);
            $table->index(['tenant_id', 'status']);
        });

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            foreach ([
                'fleet_trip_logs',
                'fleet_fuel_logs',
                'fleet_service_schedules',
                'fleet_drivers',
                'fleet_bookings',
            ] as $table) {
                if (! Schema::hasTable($table)) {
                    continue;
                }
                DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {$table} TO app_user");
                DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('fleet_bookings');
        Schema::dropIfExists('fleet_drivers');
    }
};
