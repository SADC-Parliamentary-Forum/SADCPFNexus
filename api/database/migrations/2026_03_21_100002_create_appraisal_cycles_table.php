<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('appraisal_cycles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users');
            $table->string('title');
            $table->string('description')->nullable();
            $table->date('period_start');
            $table->date('period_end');
            $table->date('submission_deadline')->nullable();
            $table->string('status', 32)->default('draft'); // draft, active, closed
            $table->timestamps();
        });
        Schema::table('appraisal_cycles', fn (Blueprint $t) => $t->index(['tenant_id', 'status']));
    }
    public function down(): void { Schema::dropIfExists('appraisal_cycles'); }
};
