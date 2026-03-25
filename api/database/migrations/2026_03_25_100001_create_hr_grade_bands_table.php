<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hr_grade_bands', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();

            // Identity
            $table->string('code', 10)->comment('e.g. A1, B2, D1');
            $table->string('label', 100)->comment('e.g. Executive Director, Senior Officer');
            $table->string('band_group', 5)->comment('A=Executive, B=Manager/Senior, C=Officer, D=Support');
            $table->string('employment_category', 20)->default('local')->comment('local | regional | researcher');

            // Notch range (salary scale has the actual figures; these are max/min caps)
            $table->unsignedTinyInteger('min_notch')->default(1);
            $table->unsignedTinyInteger('max_notch')->default(12);

            // Employment conditions
            $table->unsignedTinyInteger('probation_months')->default(6);
            $table->unsignedSmallInteger('notice_period_days')->default(30);
            $table->decimal('leave_days_per_year', 5, 1)->default(21.0);

            // Eligibility flags
            $table->boolean('overtime_eligible')->default(false);
            $table->decimal('acting_allowance_rate', 5, 4)->nullable()->comment('Fraction of base, e.g. 0.1000 = 10%');
            $table->string('travel_class', 20)->nullable()->comment('economy | business | first');
            $table->boolean('medical_aid_eligible')->default(true);
            $table->boolean('housing_allowance_eligible')->default(false);

            // Job family link
            $table->foreignId('job_family_id')->nullable()->constrained('hr_job_families')->nullOnDelete();

            // Lifecycle / change-control
            $table->string('status', 20)->default('draft')
                ->comment('draft | review | approved | published | archived');
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->unsignedSmallInteger('version_number')->default(1);

            // Created by (not FK to avoid cascade complications; store plain ID)
            $table->unsignedBigInteger('created_by')->nullable();

            // Workflow actors
            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->unsignedBigInteger('published_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('published_at')->nullable();

            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'code', 'version_number']);
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'band_group']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_grade_bands');
    }
};
