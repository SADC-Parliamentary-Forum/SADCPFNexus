<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hr_vip_import_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('batch_number', 32)->unique();
            $table->string('status', 32)->default('draft');
            $table->unsignedInteger('asset_count_before')->nullable();
            $table->unsignedInteger('asset_count_after')->nullable();
            $table->json('staged')->nullable();
            $table->json('preview')->nullable();
            $table->json('commit_summary')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamp('committed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('hr_vip_import_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('import_batch_id')->constrained('hr_vip_import_batches')->cascadeOnDelete();
            $table->string('role', 64);
            $table->string('original_filename');
            $table->string('storage_path');
            $table->string('mime', 128)->nullable();
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_vip_import_files');
        Schema::dropIfExists('hr_vip_import_batches');
    }
};
