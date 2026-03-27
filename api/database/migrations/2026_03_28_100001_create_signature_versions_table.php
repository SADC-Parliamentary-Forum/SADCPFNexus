<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('signature_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('profile_id')->constrained('signature_profiles')->cascadeOnDelete();
            $table->string('file_path');
            $table->string('hash', 64); // SHA-256 of the image file
            $table->unsignedInteger('version_no')->default(1);
            $table->timestamp('effective_from')->useCurrent();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('signature_versions');
    }
};
