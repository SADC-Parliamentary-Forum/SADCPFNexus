<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('correspondence_contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('full_name');
            $table->string('organization')->nullable();
            $table->string('country', 128)->nullable();
            $table->string('email');
            $table->string('phone', 32)->nullable();
            $table->string('stakeholder_type', 32)->default('other');
            // member_parliament|ministry|ngo|donor|private_sector|other
            $table->json('tags')->default('[]');
            $table->timestamps();
        });

        Schema::table('correspondence_contacts', function (Blueprint $table) {
            $table->index(['tenant_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('correspondence_contacts');
    }
};
