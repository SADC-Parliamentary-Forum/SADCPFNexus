<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attachments', function (Blueprint $table) {
            $table->boolean('is_chosen_quote')->default(false)->after('size_bytes');
            $table->text('selection_reason')->nullable()->after('is_chosen_quote');
        });
    }

    public function down(): void
    {
        Schema::table('attachments', function (Blueprint $table) {
            $table->dropColumn(['is_chosen_quote', 'selection_reason']);
        });
    }
};
