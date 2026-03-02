<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event');
            $table->string('auditable_type')->nullable();
            $table->unsignedBigInteger('auditable_id')->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('url')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->string('tags')->nullable();
            // Hash chain for tamper detection
            $table->string('entry_hash', 64)->nullable();
            $table->string('previous_hash', 64)->nullable();
            $table->timestamp('created_at')->useCurrent();
            // NO updated_at — immutable
        });

        // Prevent updates and deletes via DB trigger
        DB::statement("
            CREATE OR REPLACE RULE audit_logs_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
        ");
        DB::statement("
            CREATE OR REPLACE RULE audit_logs_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;
        ");
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
