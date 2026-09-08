<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenant_mail_settings', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->boolean('smtp_enabled')->default(true);
            $table->string('smtp_host')->nullable();
            $table->unsignedSmallInteger('smtp_port')->nullable();
            $table->string('smtp_encryption', 16)->nullable();
            $table->string('smtp_username')->nullable();
            $table->text('smtp_password_encrypted')->nullable();
            $table->string('smtp_from_address')->nullable();
            $table->string('smtp_from_name')->nullable();
            $table->boolean('procurement_imap_enabled')->default(true);
            $table->string('procurement_mailbox_address')->nullable();
            $table->string('procurement_imap_host')->nullable();
            $table->unsignedSmallInteger('procurement_imap_port')->nullable();
            $table->string('procurement_imap_encryption', 16)->nullable();
            $table->string('procurement_imap_username')->nullable();
            $table->text('procurement_imap_password_encrypted')->nullable();
            $table->string('procurement_imap_mailbox')->nullable();
            $table->text('procurement_imap_allowlist')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();

            $table->unique('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('updated_by')->references('id')->on('users')->nullOnDelete();
        });

        if (DB::getDriverName() === 'pgsql' && Schema::hasTable('tenant_mail_settings')) {
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tenant_mail_settings TO app_user');
            DB::statement('GRANT USAGE, SELECT ON SEQUENCE tenant_mail_settings_id_seq TO app_user');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_mail_settings');
    }
};
