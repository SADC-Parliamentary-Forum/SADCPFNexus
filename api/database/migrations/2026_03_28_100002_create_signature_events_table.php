<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('signature_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('signable_type');
            $table->unsignedBigInteger('signable_id');
            $table->string('step_key', 64)->nullable(); // e.g. 'review', 'approve', 'send'
            $table->foreignId('signer_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('signature_version_id')->nullable()->constrained('signature_versions')->nullOnDelete();
            $table->string('action', 32); // approve | reject | review | return
            $table->text('comment')->nullable();
            $table->string('auth_level', 16)->default('session'); // session | password | otp
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->string('document_hash', 64)->nullable();
            $table->boolean('is_delegated')->default(false);
            $table->unsignedBigInteger('delegated_authority_id')->nullable();
            $table->timestamp('signed_at')->useCurrent();
            $table->index(['signable_type', 'signable_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('signature_events');
    }
};
