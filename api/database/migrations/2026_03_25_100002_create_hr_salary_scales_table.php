<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hr_salary_scales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();

            // Must reference a grade band; cannot delete grade if scales exist
            $table->foreignId('grade_band_id')->constrained('hr_grade_bands')->restrictOnDelete();

            $table->string('currency', 3)->default('NAD');

            // JSON array: [{notch: 1, annual: 480000, monthly: 40000}, ...] max 12 notches
            $table->json('notches');

            // Lifecycle / change-control
            $table->string('status', 20)->default('draft')
                ->comment('draft | review | approved | published | archived');
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->unsignedSmallInteger('version_number')->default(1);

            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->unsignedBigInteger('published_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('published_at')->nullable();

            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'grade_band_id', 'status']);
            $table->unique(['tenant_id', 'grade_band_id', 'version_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_salary_scales');
    }
};
