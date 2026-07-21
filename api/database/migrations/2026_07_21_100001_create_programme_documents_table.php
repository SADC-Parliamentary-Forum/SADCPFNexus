<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('programme_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('programme_id')->constrained()->cascadeOnDelete();
            $table->index('programme_id');
            $table->string('title');
            $table->string('document_type');
            $table->integer('word_count')->nullable();
            $table->boolean('translation_required')->default(false);
            $table->string('source_language')->nullable();
            $table->text('target_languages')->nullable(); // JSON array
            $table->foreignId('owner_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('owner_name')->nullable();
            $table->string('owner_organisation')->nullable();
            $table->date('deadline')->nullable();
            $table->string('budget_line')->nullable();
            $table->text('comments')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('programme_documents');
    }
};
