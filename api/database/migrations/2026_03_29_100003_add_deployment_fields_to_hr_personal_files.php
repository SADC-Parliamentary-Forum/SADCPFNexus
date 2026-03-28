<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hr_personal_files', function (Blueprint $table) {
            $table->boolean('hr_managed_externally')->default(false)->after('archival_status');
            $table->unsignedBigInteger('active_deployment_id')->nullable()->after('hr_managed_externally');
        });
    }

    public function down(): void
    {
        Schema::table('hr_personal_files', function (Blueprint $table) {
            $table->dropColumn(['hr_managed_externally', 'active_deployment_id']);
        });
    }
};
