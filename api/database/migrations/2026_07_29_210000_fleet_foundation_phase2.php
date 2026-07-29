<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fleet_trip_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnDelete();
            $table->foreignId('driver_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->unsignedInteger('start_odometer_km')->nullable();
            $table->unsignedInteger('end_odometer_km')->nullable();
            $table->unsignedInteger('distance_km')->nullable();
            $table->string('purpose')->nullable();
            $table->string('origin')->nullable();
            $table->string('destination')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'asset_id', 'started_at']);
        });

        Schema::create('fleet_fuel_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnDelete();
            $table->timestamp('logged_at');
            $table->decimal('litres', 10, 2);
            $table->decimal('cost_amount', 12, 2)->nullable();
            $table->string('currency', 3)->default('NAD');
            $table->unsignedInteger('odometer_km')->nullable();
            $table->string('station')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'asset_id', 'logged_at']);
        });

        Schema::create('fleet_service_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnDelete();
            $table->string('service_type', 64)->default('service'); // service|inspection|tyres|other
            $table->unsignedInteger('interval_km')->nullable();
            $table->unsignedInteger('interval_days')->nullable();
            $table->date('last_service_at')->nullable();
            $table->unsignedInteger('last_service_odometer_km')->nullable();
            $table->date('next_due_at')->nullable();
            $table->unsignedInteger('next_due_odometer_km')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'asset_id']);
            $table->index(['tenant_id', 'next_due_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fleet_service_schedules');
        Schema::dropIfExists('fleet_fuel_logs');
        Schema::dropIfExists('fleet_trip_logs');
    }
};
