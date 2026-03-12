<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('conduct_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('recorded_by')->constrained('users');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('hr_file_id')->nullable()->constrained('hr_personal_files')->nullOnDelete();
            // Type: positive or negative
            $table->string('record_type', 64); // commendation, verbal_counseling, written_warning, final_warning, suspension, dismissal, performance_improvement
            $table->string('status', 32)->default('open'); // open, acknowledged, under_appeal, resolved, closed
            $table->string('title');
            $table->text('description');
            $table->date('incident_date')->nullable();
            $table->date('issue_date');
            $table->text('outcome')->nullable();
            $table->text('appeal_notes')->nullable();
            $table->date('resolution_date')->nullable();
            $table->boolean('is_confidential')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::table('conduct_records', fn (Blueprint $t) => $t->index(['tenant_id', 'employee_id', 'record_type']));
        Schema::table('conduct_records', fn (Blueprint $t) => $t->index(['tenant_id', 'status']));
    }
    public function down(): void { Schema::dropIfExists('conduct_records'); }
};
