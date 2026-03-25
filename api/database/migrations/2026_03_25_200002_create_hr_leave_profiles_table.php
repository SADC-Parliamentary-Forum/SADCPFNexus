<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hr_leave_profiles', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('profile_code', 20);
            $table->string('profile_name', 100);
            $table->decimal('annual_leave_days', 5, 1)->default(21.0);
            $table->decimal('sick_leave_days', 5, 1)->default(30.0);
            $table->decimal('lil_days', 5, 1)->default(0);
            $table->decimal('special_leave_days', 5, 1)->default(3.0);
            $table->smallInteger('maternity_days')->default(84);
            $table->smallInteger('paternity_days')->default(5);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'profile_code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_leave_profiles');
    }
};
