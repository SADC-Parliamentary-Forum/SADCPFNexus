<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('staff_deployments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('parliament_id')->constrained('parliaments')->cascadeOnDelete();
            $table->string('reference_number', 32)->unique();
            $table->string('deployment_type', 32)->default('srhr_researcher'); // srhr_researcher|secondment|other
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->string('status', 32)->default('active'); // active|completed|recalled|suspended
            $table->string('supervisor_name')->nullable();
            $table->string('supervisor_title')->nullable();
            $table->string('supervisor_email')->nullable();
            $table->string('supervisor_phone', 32)->nullable();
            $table->text('terms_of_reference')->nullable();
            $table->boolean('hr_managed_externally')->default(true);
            $table->boolean('payroll_active')->default(true);
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('recalled_at')->nullable();
            $table->text('recalled_reason')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::table('staff_deployments', function (Blueprint $table) {
            $table->index(['tenant_id']);
            $table->index(['tenant_id', 'employee_id']);
            $table->index(['tenant_id', 'parliament_id']);
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'deployment_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_deployments');
    }
};
