<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ledger_verifications', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('initiated_by')->nullable(); // null = system/auto
            $table->enum('type', ['manual', 'scheduled'])->default('manual');
            $table->enum('status', ['pass', 'fail'])->default('pass');
            $table->string('manifest_hash', 64)->nullable();
            $table->unsignedInteger('entries_checked')->default(0);
            $table->text('notes')->nullable();
            $table->timestamp('verified_at')->useCurrent();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants');
            $table->foreign('initiated_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ledger_verifications');
    }
};
