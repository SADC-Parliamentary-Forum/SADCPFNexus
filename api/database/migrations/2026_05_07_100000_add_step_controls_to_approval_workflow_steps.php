<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('approval_workflow_steps', function (Blueprint $table) {
            $table->string('step_name', 100)->nullable()->after('step_order');
            $table->boolean('allow_return')->default(false)->after('user_id');
            $table->boolean('allow_reject')->default(true)->after('allow_return');
            $table->boolean('allow_delegate')->default(false)->after('allow_reject');
            $table->unsignedSmallInteger('sla_hours')->nullable()->after('allow_delegate');
            $table->boolean('requires_comment')->default(false)->after('sla_hours');
        });
    }

    public function down(): void
    {
        Schema::table('approval_workflow_steps', function (Blueprint $table) {
            $table->dropColumn(['step_name', 'allow_return', 'allow_reject', 'allow_delegate', 'sla_hours', 'requires_comment']);
        });
    }
};
