<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('governance_resolutions', function (Blueprint $table) {
            $table->string('type')->default('plenary')->after('tenant_id');
            $table->string('committee')->nullable()->after('type');
            $table->string('lead_member')->nullable()->after('committee');
            $table->string('lead_role')->nullable()->after('lead_member');
        });
    }
    public function down(): void
    {
        Schema::table('governance_resolutions', function (Blueprint $table) {
            $table->dropColumn(['type', 'committee', 'lead_member', 'lead_role']);
        });
    }
};
