<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $column) {
            $column->string('nationality')->nullable();
            $column->string('gender')->nullable();
            $column->string('marital_status')->nullable();
            $column->string('emergency_contact_name')->nullable();
            $column->string('emergency_contact_relationship')->nullable();
            $column->string('emergency_contact_phone')->nullable();
            $column->string('address_line1')->nullable();
            $column->string('address_line2')->nullable();
            $column->string('city')->nullable();
            $column->string('country')->nullable();
            $column->json('skills')->nullable();
            $column->json('qualifications')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $column) {
            $column->dropColumn([
                'nationality', 'gender', 'marital_status',
                'emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone',
                'address_line1', 'address_line2', 'city', 'country',
                'skills', 'qualifications'
            ]);
        });
    }
};
