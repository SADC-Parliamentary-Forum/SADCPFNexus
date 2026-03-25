<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hr_appraisal_templates', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->enum('cycle_frequency', ['annual', 'bi_annual', 'quarterly'])->default('annual');
            $table->tinyInteger('rating_scale_max')->default(5);
            $table->tinyInteger('kra_count_default')->default(5);
            $table->boolean('is_probation_template')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_appraisal_templates');
    }
};
