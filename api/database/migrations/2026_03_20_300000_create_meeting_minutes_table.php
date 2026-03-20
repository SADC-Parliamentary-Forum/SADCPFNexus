<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meeting_minutes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('created_by');
            $table->unsignedBigInteger('workplan_event_id')->nullable();
            $table->string('title');
            $table->date('meeting_date');
            $table->string('location')->nullable();
            $table->string('meeting_type')->default('staff'); // staff|committee|board|ad_hoc|general
            $table->string('status')->default('draft');       // draft|final
            $table->string('chairperson')->nullable();
            $table->jsonb('attendees')->default('[]');
            $table->jsonb('apologies')->default('[]');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
        });

        Schema::create('meeting_action_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('meeting_minutes_id');
            $table->text('description');
            $table->unsignedBigInteger('responsible_id')->nullable();
            $table->string('responsible_name')->nullable(); // fallback for external
            $table->date('deadline')->nullable();
            $table->unsignedBigInteger('assignment_id')->nullable(); // set when formally assigned
            $table->string('status')->default('open'); // open|in_progress|completed|cancelled
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('meeting_minutes_id')->references('id')->on('meeting_minutes')->onDelete('cascade');
            $table->foreign('responsible_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('assignment_id')->references('id')->on('assignments')->onDelete('set null');
        });

        // Grant permissions to app_user
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE meeting_minutes TO app_user');
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE meeting_action_items TO app_user');
        DB::statement('GRANT USAGE, SELECT ON SEQUENCE meeting_minutes_id_seq TO app_user');
        DB::statement('GRANT USAGE, SELECT ON SEQUENCE meeting_action_items_id_seq TO app_user');
    }

    public function down(): void
    {
        Schema::dropIfExists('meeting_action_items');
        Schema::dropIfExists('meeting_minutes');
    }
};
