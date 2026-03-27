<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('correspondence_recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('correspondence_id')->constrained('correspondence')->cascadeOnDelete();
            $table->foreignId('contact_id')->constrained('correspondence_contacts')->cascadeOnDelete();
            $table->string('recipient_type', 4)->default('to'); // to|cc|bcc
            $table->timestamp('email_sent_at')->nullable();
            $table->string('email_status', 32)->nullable(); // queued|sent|failed
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('correspondence_recipients');
    }
};
