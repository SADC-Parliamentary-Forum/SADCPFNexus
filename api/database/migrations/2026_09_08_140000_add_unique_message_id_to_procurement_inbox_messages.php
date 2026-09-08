<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('procurement_inbox_messages', function (Blueprint $table) {
            $table->unique(['tenant_id', 'message_id'], 'procurement_inbox_tenant_message_unique');
        });
    }

    public function down(): void
    {
        Schema::table('procurement_inbox_messages', function (Blueprint $table) {
            $table->dropUnique('procurement_inbox_tenant_message_unique');
        });
    }
};
