<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('risk_bcp_exercises', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('risk_id')->nullable()->constrained('risks')->nullOnDelete();
            $table->foreignId('bcp_link_id')->nullable()->constrained('risk_bcp_links')->nullOnDelete();
            $table->string('title');
            $table->string('exercise_type', 32)->default('tabletop'); // tabletop|drill|full
            $table->string('status', 32)->default('planned'); // planned|in_progress|completed|cancelled
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->string('result', 32)->nullable(); // pass|fail|partial
            $table->text('outcome_notes')->nullable();
            $table->foreignId('facilitator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'status', 'scheduled_at']);
        });

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            $tables = [
                'risk_bcp_exercises',
                'asset_insurance_policies',
                'asset_insurance_claims',
            ];
            foreach ($tables as $table) {
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
        Schema::dropIfExists('risk_bcp_exercises');
    }
};
