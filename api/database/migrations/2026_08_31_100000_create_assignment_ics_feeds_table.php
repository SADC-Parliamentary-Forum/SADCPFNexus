<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('assignment_ics_feeds')) {
            Schema::create('assignment_ics_feeds', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('token_hash', 64)->unique();
                $table->text('token_encrypted');
                $table->string('scope', 32)->default('mine');
                $table->timestamp('last_used_at')->nullable();
                $table->timestamp('revoked_at')->nullable()->index();
                $table->timestamps();

                $table->index(['user_id', 'revoked_at']);
            });
        }

        if (DB::getDriverName() === 'pgsql') {
            try {
                DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE assignment_ics_feeds TO app_user');
                DB::statement('GRANT USAGE, SELECT ON SEQUENCE assignment_ics_feeds_id_seq TO app_user');
            } catch (Throwable) {
                // Local/test databases may not have the app_user role.
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('assignment_ics_feeds');
    }
};
