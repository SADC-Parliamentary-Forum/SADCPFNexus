<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('imprest_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('imprest_requests', 'budget_line_id')) {
                $table->foreignId('budget_line_id')
                    ->nullable()
                    ->after('budget_line')
                    ->constrained('budget_lines')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('imprest_requests', function (Blueprint $table) {
            if (Schema::hasColumn('imprest_requests', 'budget_line_id')) {
                $table->dropConstrainedForeignId('budget_line_id');
            }
        });
    }
};
