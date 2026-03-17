<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('programmes', function (Blueprint $table) {
            $table->text('strategic_pillars')->nullable()->after('strategic_pillar');
            $table->text('implementing_departments')->nullable()->after('implementing_department');
            $table->text('responsible_officer_ids')->nullable()->after('responsible_officer_id');
            $table->text('funding_sources')->nullable()->after('funding_source');
        });
    }

    public function down(): void
    {
        Schema::table('programmes', function (Blueprint $table) {
            $table->dropColumn([
                'strategic_pillars',
                'implementing_departments',
                'responsible_officer_ids',
                'funding_sources',
            ]);
        });
    }
};
