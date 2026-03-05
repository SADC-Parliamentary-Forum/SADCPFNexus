<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('programme_milestones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('programme_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->date('target_date');
            $table->date('achieved_date')->nullable();
            $table->tinyInteger('completion_pct')->default(0);
            $table->string('status')->default('pending');
            // pending|achieved|missed
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('programme_milestones');
    }
};
