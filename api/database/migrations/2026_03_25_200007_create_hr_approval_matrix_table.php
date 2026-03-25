<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hr_approval_matrix', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('module', 50);
            $table->string('action_name', 100);
            $table->tinyInteger('step_number')->default(1);
            $table->unsignedBigInteger('role_id')->nullable();
            $table->foreign('role_id')->references('id')->on('roles')->nullOnDelete();
            $table->unsignedBigInteger('approver_user_id')->nullable();
            $table->foreign('approver_user_id')->references('id')->on('users')->nullOnDelete();
            $table->boolean('is_mandatory')->default(true);
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['tenant_id', 'module']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_approval_matrix');
    }
};
