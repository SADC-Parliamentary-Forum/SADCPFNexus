<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('programme_arrival_departures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('programme_id')->constrained()->cascadeOnDelete();
            $table->index('programme_id');
            $table->string('category');
            // participant|secretariat|rapporteur|consultant|resource_person|
            // media_liaison|expert|ict_support|interpreter|local_support|other
            $table->date('arrival_date')->nullable();
            $table->date('departure_date')->nullable();
            $table->string('airport')->nullable();
            $table->text('flight_details')->nullable();
            $table->boolean('transport_required')->default(false);
            $table->boolean('accommodation_required')->default(false);
            $table->text('comments')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('programme_arrival_departures');
    }
};
