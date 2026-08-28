<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('gl_journals')) {
            Schema::create('gl_journals', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->string('journal_no', 40);
                $table->unsignedBigInteger('budget_line_id')->nullable()->index();
                $table->string('source_module', 64)->nullable();
                $table->unsignedBigInteger('source_id')->nullable();
                $table->string('status', 24)->default('posted');
                $table->string('memo', 1000)->nullable();
                $table->unsignedBigInteger('posted_by')->nullable();
                $table->timestamp('posted_at')->nullable();
                $table->timestamps();
                $table->unique(['tenant_id', 'journal_no']);
            });
        }

        if (! Schema::hasTable('gl_journal_lines')) {
            Schema::create('gl_journal_lines', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('gl_journal_id')->index();
                $table->unsignedBigInteger('budget_line_id')->nullable()->index();
                $table->string('gl_account_code', 60)->nullable();
                $table->decimal('debit', 15, 2)->default(0);
                $table->decimal('credit', 15, 2)->default(0);
                $table->string('description', 500)->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('inventory_register_entries')) {
            Schema::create('inventory_register_entries', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('goods_receipt_note_id')->nullable()->index();
                $table->unsignedBigInteger('goods_receipt_item_id')->nullable();
                $table->unsignedBigInteger('asset_id')->nullable()->index();
                $table->unsignedBigInteger('stock_item_id')->nullable()->index();
                $table->string('source', 32)->default('grn');
                $table->string('label')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('attendance_clock_events')) {
            Schema::create('attendance_clock_events', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('direction', 8);
                $table->string('method', 32)->default('manual');
                $table->boolean('device_attested')->default(false);
                $table->string('device_id', 128)->nullable();
                $table->timestamp('clocked_at');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('access_role_sync_requests')) {
            Schema::create('access_role_sync_requests', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('user_id')->index();
                $table->json('roles');
                $table->unsignedBigInteger('requested_by');
                $table->unsignedBigInteger('approved_by')->nullable();
                $table->string('status', 32)->default('pending_approval');
                $table->text('reason')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('worm_archive_entries')) {
            Schema::create('worm_archive_entries', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->string('event_key');
                $table->json('payload')->nullable();
                $table->string('content_hash', 64);
                $table->string('previous_hash', 64)->nullable();
                $table->unsignedInteger('sequence')->default(1);
                $table->timestamps();
                $table->index(['tenant_id', 'sequence']);
            });
        }

        if (Schema::hasTable('correspondence_mailbox_settings')
            && ! Schema::hasColumn('correspondence_mailbox_settings', 'allowlisted_addresses')) {
            Schema::table('correspondence_mailbox_settings', function (Blueprint $table) {
                $table->json('allowlisted_addresses')->nullable();
            });
        }

        if (Schema::hasTable('tenders') && ! Schema::hasColumn('tenders', 'award_recommendation')) {
            Schema::table('tenders', function (Blueprint $table) {
                $table->json('award_recommendation')->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('worm_archive_entries');
        Schema::dropIfExists('access_role_sync_requests');
        Schema::dropIfExists('attendance_clock_events');
        Schema::dropIfExists('inventory_register_entries');
        Schema::dropIfExists('gl_journal_lines');
        Schema::dropIfExists('gl_journals');
    }
};
