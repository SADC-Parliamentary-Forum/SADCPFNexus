<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('programme_budget_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('programme_id')->constrained()->cascadeOnDelete();
            $table->string('category');
            // staff_costs|consultancy|travel_dsa|meetings_workshops|equipment|supplies|
            // communication|reporting|audit|visibility|contingency|other
            $table->string('description');
            $table->decimal('amount', 12, 2);
            $table->decimal('actual_spent', 12, 2)->default(0);
            $table->string('funding_source')->default('core_budget');
            // core_budget|donor|cost_sharing|other
            $table->string('account_code')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('programme_budget_lines');
    }
};
