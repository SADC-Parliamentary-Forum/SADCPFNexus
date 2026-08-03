<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('permission_usage_events')) {
            Schema::create('permission_usage_events', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->nullable()->index();
                $table->unsignedBigInteger('actor_id')->nullable()->index();
                $table->string('permission_key')->index();
                $table->string('decision')->index();
                $table->string('reason_code')->nullable()->index();
                $table->string('source')->nullable();
                $table->string('auditable_type')->nullable();
                $table->unsignedBigInteger('auditable_id')->nullable();
                $table->json('context')->nullable();
                $table->string('correlation_id')->nullable()->index();
                $table->timestamp('occurred_at')->index();
                $table->timestamps();

                $table->index(['auditable_type', 'auditable_id']);
            });
        }

        if (DB::getDriverName() === 'pgsql') {
            try {
                DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE permission_usage_events TO app_user');
                DB::statement('GRANT USAGE, SELECT ON SEQUENCE permission_usage_events_id_seq TO app_user');
            } catch (Throwable) {
                // Local/test databases may not have the app_user role.
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('permission_usage_events');
    }
};
