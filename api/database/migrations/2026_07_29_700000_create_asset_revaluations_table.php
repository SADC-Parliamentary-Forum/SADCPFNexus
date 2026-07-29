<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_revaluations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnDelete();
            $table->string('reference', 32);
            $table->string('status', 32)->default('pending');
            $table->decimal('previous_book_value', 14, 2)->nullable();
            $table->decimal('proposed_value', 14, 2);
            $table->text('reason');
            $table->date('effective_date');
            $table->foreignId('requested_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->text('approval_comments')->nullable();
            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('rejected_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'reference']);
            $table->index(['tenant_id', 'status']);
            $table->index(['asset_id', 'status']);
        });

        if (DB::getDriverName() === 'pgsql') {
            $user = config('database.connections.pgsql.app_user', env('DB_APP_USERNAME'));
            if ($user && Schema::hasTable('asset_revaluations')) {
                DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE asset_revaluations TO "'.$user.'"');
                DB::statement('GRANT USAGE, SELECT ON SEQUENCE asset_revaluations_id_seq TO "'.$user.'"');
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_revaluations');
    }
};
