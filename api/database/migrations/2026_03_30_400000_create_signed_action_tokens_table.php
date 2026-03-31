<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('signed_action_tokens', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('approval_request_id');
            $table->unsignedBigInteger('approver_user_id');
            $table->string('token', 64)->unique();
            $table->enum('action', ['approve', 'reject']);
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();

            $table->foreign('approval_request_id')
                ->references('id')->on('approval_requests')
                ->cascadeOnDelete();

            $table->foreign('approver_user_id')
                ->references('id')->on('users')
                ->cascadeOnDelete();

            $table->index(['token', 'used_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('signed_action_tokens');
    }
};
