<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('uploaded_by')->constrained('users')->cascadeOnDelete();
            $table->string('attachable_type')->nullable();
            $table->unsignedBigInteger('attachable_id')->nullable();
            $table->string('original_filename');
            $table->string('storage_path');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->enum('quarantine_status', ['pending', 'clean', 'infected', 'error'])->default('pending');
            $table->timestamp('scanned_at')->nullable();
            $table->string('classification', 20)->default('UNCLASSIFIED');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attachments');
    }
};
