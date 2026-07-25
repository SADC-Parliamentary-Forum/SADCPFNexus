<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('me_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->boolean('auto_intake')->default(true);
            $table->unsignedSmallInteger('report_due_days')->default(14);
            $table->boolean('programme_manager_review')->default(false);
            $table->timestamps();

            $table->unique('tenant_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('me_settings');
    }
};
