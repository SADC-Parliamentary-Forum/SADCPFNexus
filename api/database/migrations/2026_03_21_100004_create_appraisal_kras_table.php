<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('appraisal_kras', function (Blueprint $table) {
            $table->id();
            $table->foreignId('appraisal_id')->constrained('appraisals')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->decimal('weight', 5, 2)->default(0); // percentage weight
            $table->unsignedTinyInteger('self_rating')->nullable(); // 1-5
            $table->text('self_comments')->nullable();
            $table->unsignedTinyInteger('supervisor_rating')->nullable();
            $table->text('supervisor_comments')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });
        Schema::table('appraisal_kras', fn (Blueprint $t) => $t->index(['appraisal_id']));
    }
    public function down(): void { Schema::dropIfExists('appraisal_kras'); }
};
