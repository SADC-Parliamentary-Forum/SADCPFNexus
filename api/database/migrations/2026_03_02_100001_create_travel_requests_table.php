<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('travel_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reference_number')->unique();
            $table->string('purpose');
            $table->string('status')->default('draft'); // draft, submitted, approved, rejected, cancelled
            $table->date('departure_date');
            $table->date('return_date');
            $table->string('destination_country');
            $table->string('destination_city')->nullable();
            $table->decimal('estimated_dsa', 10, 2)->default(0);
            $table->decimal('actual_dsa', 10, 2)->nullable();
            $table->string('currency', 3)->default('USD');
            $table->text('justification')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('travel_itineraries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('travel_request_id')->constrained()->cascadeOnDelete();
            $table->string('from_location');
            $table->string('to_location');
            $table->date('travel_date');
            $table->string('transport_mode'); // flight, road, rail
            $table->decimal('dsa_rate', 10, 2)->default(0);
            $table->integer('days_count')->default(1);
            $table->decimal('calculated_dsa', 10, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('travel_itineraries');
        Schema::dropIfExists('travel_requests');
    }
};
