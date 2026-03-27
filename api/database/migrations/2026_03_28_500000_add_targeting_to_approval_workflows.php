<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('approval_workflows', function (Blueprint $table) {
            // Drop simple unique on module_type — we now allow multiple workflows per module
            $table->dropUnique('approval_workflows_module_type_unique');

            // Targeting: optional programme or department scope
            $table->string('target_type', 32)->nullable()->after('module_type'); // 'programme' | 'department' | null
            $table->unsignedBigInteger('target_id')->nullable()->after('target_type');
        });
    }

    public function down(): void
    {
        Schema::table('approval_workflows', function (Blueprint $table) {
            $table->dropColumn(['target_type', 'target_id']);
            $table->unique('module_type');
        });
    }
};
