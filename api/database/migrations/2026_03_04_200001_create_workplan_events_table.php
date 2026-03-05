<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('workplan_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->string('type')->default('meeting');
            // meeting|travel|leave|milestone|deadline
            $table->date('date');
            $table->date('end_date')->nullable();
            $table->text('description')->nullable();
            $table->string('responsible')->nullable();
            $table->string('linked_module')->nullable();
            $table->unsignedBigInteger('linked_id')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('workplan_events');
    }
};
