<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hr_incidents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reported_by')->constrained('users')->cascadeOnDelete();
            $table->string('reference_number', 32)->unique();
            $table->string('subject');
            $table->text('description')->nullable();
            $table->string('status', 32)->default('reported'); // reported, investigation, hearing, resolved, closed
            $table->string('severity', 32)->default('medium'); // low, medium, high
            $table->timestamp('reported_at')->useCurrent();
            $table->timestamps();
        });
        Schema::table('hr_incidents', fn (Blueprint $t) => $t->index(['tenant_id', 'status']));
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_incidents');
    }
};
