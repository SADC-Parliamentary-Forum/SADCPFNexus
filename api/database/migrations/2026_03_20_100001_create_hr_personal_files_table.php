<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('hr_personal_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users');
            $table->foreignId('current_hr_officer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->foreignId('supervisor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('file_status', 32)->default('active'); // active, probation, suspended, separated, archived
            $table->string('confidentiality_classification', 32)->default('standard'); // standard, restricted, confidential
            $table->string('staff_number', 64)->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('gender', 32)->nullable();
            $table->string('nationality', 64)->nullable();
            $table->string('id_passport_number', 64)->nullable();
            $table->string('marital_status', 32)->nullable();
            $table->text('residential_address')->nullable();
            $table->string('emergency_contact_name')->nullable();
            $table->string('emergency_contact_relationship', 64)->nullable();
            $table->string('emergency_contact_phone', 32)->nullable();
            $table->text('next_of_kin_details')->nullable();
            $table->date('appointment_date')->nullable();
            $table->string('employment_status', 32)->default('permanent'); // permanent, contract, secondment, acting, probation, separated
            $table->string('contract_type', 64)->nullable();
            $table->string('probation_status', 32)->default('not_applicable'); // on_probation, confirmed, extended, terminated, not_applicable
            $table->date('confirmation_date')->nullable();
            $table->string('current_position')->nullable();
            $table->string('grade_scale', 64)->nullable();
            $table->date('contract_expiry_date')->nullable();
            $table->date('separation_date')->nullable();
            $table->string('separation_reason')->nullable();
            $table->json('promotion_history')->nullable();
            $table->json('transfer_history')->nullable();
            $table->string('payroll_number', 64)->nullable();
            $table->text('latest_appraisal_summary')->nullable();
            $table->boolean('active_warning_flag')->default(false);
            $table->unsignedInteger('commendation_count')->default(0);
            $table->unsignedInteger('open_development_action_count')->default(0);
            $table->decimal('training_hours_current_cycle', 8, 2)->default(0);
            $table->date('last_file_review_date')->nullable();
            $table->boolean('archival_status')->default(false);
            $table->timestamps();
        });
        Schema::table('hr_personal_files', fn (Blueprint $t) => $t->unique(['tenant_id', 'employee_id']));
        Schema::table('hr_personal_files', fn (Blueprint $t) => $t->index(['tenant_id', 'file_status']));
        Schema::table('hr_personal_files', fn (Blueprint $t) => $t->index(['tenant_id', 'employment_status']));
    }
    public function down(): void { Schema::dropIfExists('hr_personal_files'); }
};
