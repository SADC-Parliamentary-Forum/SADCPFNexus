<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('programme_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('programme_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->decimal('budget_allocation', 12, 2)->default(0);
            $table->string('responsible')->nullable();
            $table->string('location')->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->string('status')->default('draft');
            // draft|approved|in_progress|completed|postponed|cancelled
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('programme_activities');
    }
};
