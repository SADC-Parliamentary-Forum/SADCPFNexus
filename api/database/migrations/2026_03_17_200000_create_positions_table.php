<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('positions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('department_id');
            $table->string('title');
            $table->string('grade')->nullable()->comment('e.g. A1, A2, B1, B2, B3, C1, C2, D1, D2');
            $table->text('description')->nullable();
            $table->integer('headcount')->default(1)->comment('Number of posts for this position');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('department_id')->references('id')->on('departments')->cascadeOnDelete();
            $table->index(['tenant_id', 'department_id']);
        });

        // Add position_id FK to users table (optional link — null means no formal position assigned yet)
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('position_id')->nullable()->after('department_id');
            $table->foreign('position_id')->references('id')->on('positions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['position_id']);
            $table->dropColumn('position_id');
        });
        Schema::dropIfExists('positions');
    }
};
