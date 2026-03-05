<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('programmes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reference_number')->unique();
            $table->string('title');
            $table->string('status')->default('draft');
            // draft|submitted|approved|active|on_hold|completed|financially_closed|archived
            $table->text('strategic_alignment')->nullable(); // JSON array
            $table->string('strategic_pillar')->nullable();
            $table->string('implementing_department')->nullable();
            $table->text('supporting_departments')->nullable(); // JSON array
            $table->text('background')->nullable();
            $table->text('overall_objective')->nullable();
            $table->text('specific_objectives')->nullable(); // JSON array
            $table->text('expected_outputs')->nullable(); // JSON array
            $table->text('target_beneficiaries')->nullable(); // JSON array
            $table->text('gender_considerations')->nullable();
            $table->string('primary_currency', 3)->default('USD');
            $table->string('base_currency', 3)->default('USD');
            $table->decimal('exchange_rate', 10, 4)->default(1);
            $table->decimal('contingency_pct', 5, 2)->default(10);
            $table->decimal('total_budget', 15, 2)->default(0);
            $table->string('funding_source')->nullable();
            $table->string('responsible_officer')->nullable();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->boolean('travel_required')->default(false);
            $table->integer('delegates_count')->nullable();
            $table->text('member_states')->nullable(); // JSON array
            $table->text('travel_services')->nullable(); // JSON array
            $table->boolean('procurement_required')->default(false);
            $table->text('media_options')->nullable(); // JSON array
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('programmes');
    }
};
