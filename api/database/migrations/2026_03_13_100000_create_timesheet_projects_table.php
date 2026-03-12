<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('timesheet_projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('label', 500);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
        Schema::table('timesheet_projects', fn (Blueprint $t) => $t->index('tenant_id'));
    }

    public function down(): void
    {
        Schema::dropIfExists('timesheet_projects');
    }
};
