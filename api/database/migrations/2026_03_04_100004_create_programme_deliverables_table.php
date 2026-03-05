<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('programme_deliverables', function (Blueprint $table) {
            $table->id();
            $table->foreignId('programme_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->date('due_date');
            $table->string('status')->default('pending');
            // pending|submitted|accepted
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('programme_deliverables');
    }
};
