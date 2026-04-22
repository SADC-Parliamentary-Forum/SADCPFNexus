<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_salary_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('grade_band_id')->constrained('hr_grade_bands')->restrictOnDelete();
            $table->foreignId('salary_scale_id')->nullable()->constrained('hr_salary_scales')->nullOnDelete();
            $table->unsignedTinyInteger('notch_number')->default(1);
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->string('employment_type', 32)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->softDeletes();
            $table->timestamps();

            $table->index(['user_id', 'effective_from']);
            $table->index(['tenant_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_salary_assignments');
    }
};
