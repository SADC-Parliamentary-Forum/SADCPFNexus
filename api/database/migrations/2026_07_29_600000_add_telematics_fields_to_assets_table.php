<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Telematics mapping + sync metadata on fleet vehicle Fixed Assets.
 * Extends the manual GPS stub (gps_lat / gps_lng / gps_recorded_at).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->string('telematics_device_id', 128)->nullable()->after('gps_recorded_at');
            $table->string('telematics_provider', 64)->nullable()->after('telematics_device_id');
            $table->json('telematics_raw_payload')->nullable()->after('telematics_provider');
            $table->timestamp('telematics_synced_at')->nullable()->after('telematics_raw_payload');
            $table->string('telematics_sync_status', 32)->nullable()->after('telematics_synced_at');
            $table->text('telematics_sync_error')->nullable()->after('telematics_sync_status');

            $table->index(['tenant_id', 'telematics_device_id'], 'assets_tenant_telematics_device_idx');
        });
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropIndex('assets_tenant_telematics_device_idx');
            $table->dropColumn([
                'telematics_device_id',
                'telematics_provider',
                'telematics_raw_payload',
                'telematics_synced_at',
                'telematics_sync_status',
                'telematics_sync_error',
            ]);
        });
    }
};
