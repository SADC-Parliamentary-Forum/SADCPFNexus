<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('correspondence', function (Blueprint $table) {
            $table->string('message_id', 512)->nullable()->after('sender_reference');
            $table->string('mailbox_source', 64)->nullable()->after('message_id');
        });

        // Unique per tenant when message_id is present (MySQL allows multiple NULLs)
        Schema::table('correspondence', function (Blueprint $table) {
            $table->unique(['tenant_id', 'message_id'], 'correspondence_tenant_message_id_unique');
        });

        Schema::create('correspondence_mailbox_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('mailbox_address')->nullable();
            $table->boolean('enabled')->default(false);
            $table->text('notes')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('correspondence_mailbox_suggestions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('message_id', 512);
            $table->string('subject')->nullable();
            $table->string('from_address')->nullable();
            $table->string('from_name')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->text('body_preview')->nullable();
            $table->text('raw_headers')->nullable();
            $table->string('status', 24)->default('suggested'); // suggested|imported|dismissed
            $table->foreignId('correspondence_id')->nullable()->constrained('correspondence')->nullOnDelete();
            $table->foreignId('imported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('imported_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'message_id'], 'corr_mailbox_suggestions_tenant_message_unique');
            $table->index(['tenant_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('correspondence_mailbox_suggestions');
        Schema::dropIfExists('correspondence_mailbox_settings');
        Schema::table('correspondence', function (Blueprint $table) {
            $table->dropUnique('correspondence_tenant_message_id_unique');
            $table->dropColumn(['message_id', 'mailbox_source']);
        });
    }
};
