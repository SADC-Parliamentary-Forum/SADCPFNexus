<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assignment_updates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('assignment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('submitted_by')->constrained('users')->cascadeOnDelete();

            $table->enum('type', [
                'update', 'comment', 'feedback', 'escalation', 'closure_request', 'system',
            ])->default('update');

            $table->unsignedTinyInteger('progress_percent')->nullable();
            $table->text('notes');

            $table->enum('blocker_type', [
                'awaiting_approval', 'awaiting_funds', 'awaiting_information', 'external_dependency',
            ])->nullable();
            $table->text('blocker_details')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assignment_updates');
    }
};
