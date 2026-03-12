<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('hr_file_timeline_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('hr_file_id')->constrained('hr_personal_files')->cascadeOnDelete();
            $table->foreignId('recorded_by')->constrained('users');
            $table->foreignId('linked_document_id')->nullable()->constrained('hr_file_documents')->nullOnDelete();
            $table->string('event_type', 64); // appointment, probation_start, confirmation, promotion, transfer, training, appraisal, commendation, warning, contract_renewal, acting, separation, other
            $table->string('title');
            $table->text('description')->nullable();
            $table->date('event_date');
            $table->string('source_module', 64)->nullable();
            $table->timestamps();
        });
        Schema::table('hr_file_timeline_events', fn (Blueprint $t) => $t->index(['hr_file_id', 'event_date']));
        Schema::table('hr_file_timeline_events', fn (Blueprint $t) => $t->index(['tenant_id']));
    }
    public function down(): void { Schema::dropIfExists('hr_file_timeline_events'); }
};
