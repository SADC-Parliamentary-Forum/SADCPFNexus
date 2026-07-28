<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('account_access_requests')) {
            Schema::create('account_access_requests', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
                $table->string('full_name');
                $table->string('official_email')->index();
                $table->string('position_title')->nullable();
                $table->string('department_name')->nullable();
                $table->string('supervisor_name')->nullable();
                $table->text('reason')->nullable();
                $table->string('status', 32)->default('requested')->index();
                $table->foreignId('reviewed_by_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('reviewed_at')->nullable();
                $table->text('review_comment')->nullable();
                $table->timestamps();

                $table->index(['official_email', 'status']);
            });
        }

        if (DB::getDriverName() === 'pgsql' && Schema::hasTable('account_access_requests')) {
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON account_access_requests TO app_user');
            DB::statement('GRANT USAGE, SELECT ON SEQUENCE account_access_requests_id_seq TO app_user');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('account_access_requests');
    }
};
