<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('form_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('module');
            $table->string('form_type');
            $table->json('schema'); // JSON Schema for fields
            $table->integer('version')->default(1);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('form_instances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('form_template_id')->constrained()->cascadeOnDelete();
            $table->foreignId('submitted_by')->constrained('users')->cascadeOnDelete();
            $table->json('data');
            $table->enum('status', ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'cancelled'])->default('draft');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('form_instances');
        Schema::dropIfExists('form_templates');
    }
};
