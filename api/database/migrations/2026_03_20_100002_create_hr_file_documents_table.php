<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('hr_file_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('hr_file_id')->constrained('hr_personal_files')->cascadeOnDelete();
            $table->foreignId('uploaded_by')->constrained('users');
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('document_type', 64); // identity, appointment, contract, qualification, training, appraisal, commendation, warning, leave_reference, policy_acknowledgement, medical, separation, other
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('file_path')->nullable();
            $table->string('file_name')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('confidentiality_level', 32)->default('standard');
            $table->date('issue_date')->nullable();
            $table->date('effective_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->string('source_module', 64)->nullable();
            $table->unsignedTinyInteger('version')->default(1);
            $table->json('tags')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::table('hr_file_documents', fn (Blueprint $t) => $t->index(['hr_file_id', 'document_type']));
        Schema::table('hr_file_documents', fn (Blueprint $t) => $t->index(['tenant_id']));
    }
    public function down(): void { Schema::dropIfExists('hr_file_documents'); }
};
