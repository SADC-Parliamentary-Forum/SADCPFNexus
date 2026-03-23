<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('profile_change_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();

            // JSON snapshot of the fields the user wants changed
            $table->jsonb('requested_changes');

            // Optional message from the user explaining the request
            $table->text('notes')->nullable();

            // Status lifecycle: pending → approved | rejected | cancelled
            $table->string('status', 20)->default('pending');

            // HR review
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_notes')->nullable();

            $table->timestamps();
        });

        Schema::table('profile_change_requests', function (Blueprint $t) {
            $t->index(['tenant_id', 'status']);
            $t->index(['user_id', 'status']);
        });

        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE profile_change_requests TO app_user');
        DB::statement('GRANT USAGE, SELECT ON SEQUENCE profile_change_requests_id_seq TO app_user');
    }

    public function down(): void
    {
        Schema::dropIfExists('profile_change_requests');
    }
};
