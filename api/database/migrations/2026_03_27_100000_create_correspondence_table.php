<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('correspondence', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reference_number', 64)->nullable();
            $table->string('title');
            $table->string('subject');
            $table->text('body')->nullable();
            $table->string('type', 32)->default('external'); // internal_memo|external|diplomatic_note|procurement
            $table->string('priority', 16)->default('normal'); // low|normal|high|urgent
            $table->string('language', 4)->default('en'); // en|fr|pt
            $table->string('status', 32)->default('draft'); // draft|pending_review|pending_approval|approved|sent|archived
            $table->string('direction', 8)->default('outgoing'); // outgoing|incoming
            $table->string('file_code', 32)->nullable();
            $table->string('signatory_code', 16)->nullable(); // SG|DIR|HOD
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->unsignedBigInteger('programme_id')->nullable();
            $table->string('file_path')->nullable();
            $table->string('original_filename')->nullable();
            $table->string('mime_type', 128)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->text('review_comment')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::table('correspondence', function (Blueprint $table) {
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'direction']);
            $table->index(['tenant_id', 'created_by']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('correspondence');
    }
};
