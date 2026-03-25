<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hr_personnel_file_sections', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('section_code', 30);
            $table->string('section_name', 100);
            $table->enum('visibility', ['employee', 'hr_only', 'supervisor', 'director', 'sg', 'hidden'])->default('hr_only');
            $table->boolean('is_editable_by_employee')->default(false);
            $table->boolean('is_mandatory')->default(false);
            $table->smallInteger('retention_months')->default(84);
            $table->enum('confidentiality_level', ['public', 'restricted', 'confidential'])->default('restricted');
            $table->smallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'section_code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_personnel_file_sections');
    }
};
