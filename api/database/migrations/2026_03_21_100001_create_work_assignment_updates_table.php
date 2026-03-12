<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('work_assignment_updates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('assignment_id')->constrained('work_assignments')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('update_type', 32)->default('progress'); // progress, blocker, completion, comment, review
            $table->text('content');
            $table->decimal('hours_logged', 6, 2)->nullable();
            $table->string('new_status', 32)->nullable(); // status change logged here if applicable
            $table->timestamps();
        });
        Schema::table('work_assignment_updates', fn (Blueprint $t) => $t->index(['assignment_id']));
    }
    public function down(): void { Schema::dropIfExists('work_assignment_updates'); }
};
