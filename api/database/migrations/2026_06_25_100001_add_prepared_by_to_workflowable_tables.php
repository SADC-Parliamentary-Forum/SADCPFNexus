<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * WS1 — "Prepared on behalf of" support (PRD §7.1, §28.1, §28.2).
 *
 * Adds nullable preparer / on-behalf-of references to every request type that
 * supports delegated preparation. Both columns are nullable so existing rows
 * and the normal self-service flow are unaffected.
 */
return new class extends Migration
{
    private array $tables = [
        'programmes',
        'travel_requests',
        'leave_requests',
        'salary_advance_requests',
        'procurement_requests',
    ];

    public function up(): void
    {
        foreach ($this->tables as $tableName) {
            if (!Schema::hasTable($tableName)) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                if (!Schema::hasColumn($tableName, 'prepared_by')) {
                    $table->unsignedBigInteger('prepared_by')->nullable()->after('id');
                    $table->foreign('prepared_by')->references('id')->on('users')->nullOnDelete();
                }
                if (!Schema::hasColumn($tableName, 'prepared_on_behalf_of')) {
                    $table->unsignedBigInteger('prepared_on_behalf_of')->nullable()->after('prepared_by');
                    $table->foreign('prepared_on_behalf_of')->references('id')->on('users')->nullOnDelete();
                }
                if (!Schema::hasColumn($tableName, 'delegated_authority_id')) {
                    $table->unsignedBigInteger('delegated_authority_id')->nullable()->after('prepared_on_behalf_of');
                    $table->foreign('delegated_authority_id')->references('id')->on('delegated_authorities')->nullOnDelete();
                }
            });
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $tableName) {
            if (!Schema::hasTable($tableName)) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                foreach (['prepared_by', 'prepared_on_behalf_of', 'delegated_authority_id'] as $col) {
                    if (Schema::hasColumn($tableName, $col)) {
                        $table->dropForeign([$col]);
                        $table->dropColumn($col);
                    }
                }
            });
        }
    }
};
