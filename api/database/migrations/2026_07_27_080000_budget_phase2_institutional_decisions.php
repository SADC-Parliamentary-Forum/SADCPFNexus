<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('budget_cycle_decisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('budget_cycle_id')->constrained('budget_cycles')->cascadeOnDelete();
            $table->string('body', 20); // fsc|exco|plenary
            $table->date('meeting_on')->nullable();
            $table->string('decision', 40); // approved|approved_with_amendments|deferred|rejected
            $table->string('minute_reference')->nullable();
            $table->text('comments')->nullable();
            $table->string('attachment_path')->nullable();
            $table->foreignId('recorded_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('recorded_at');
            $table->timestamps();

            $table->index(['budget_cycle_id', 'body']);
            $table->index(['budget_cycle_id', 'recorded_at']);
        });

        try {
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON budget_cycle_decisions TO app_user');
            DB::statement('GRANT USAGE, SELECT ON SEQUENCE budget_cycle_decisions_id_seq TO app_user');
        } catch (\Throwable) {
            // app_user may not exist locally/tests
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_cycle_decisions');
    }
};
