<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Server-side idempotency for retried client writes (mobile offline sync and
 * any client sending an Idempotency-Key header). One row per (user, key):
 * 'processing' while the first request runs, then 'completed' with the
 * stored response that every retry replays. See EnforceIdempotencyKey.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('idempotency_records', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('user_id');
            $table->string('idempotency_key', 128);
            $table->string('method', 10);
            $table->string('path', 255);
            $table->char('request_fingerprint', 64);
            $table->string('status', 16)->default('processing'); // processing | completed
            $table->unsignedSmallInteger('response_status')->nullable();
            $table->longText('response_body')->nullable();
            $table->timestamp('expires_at')->index();
            $table->timestamps();

            $table->unique(['user_id', 'idempotency_key'], 'idempotency_records_user_key_unique');
        });

        if (DB::getDriverName() === 'pgsql') {
            // SetRlsContext switches to app_user for every authenticated request.
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON idempotency_records TO app_user');
            DB::statement('GRANT USAGE, SELECT ON SEQUENCE idempotency_records_id_seq TO app_user');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('idempotency_records');
    }
};
