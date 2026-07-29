<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('correspondence', function (Blueprint $table) {
            if (! Schema::hasColumn('correspondence', 'retention_policy')) {
                $table->string('retention_policy', 64)->nullable()->after('physical_location');
            }
            if (! Schema::hasColumn('correspondence', 'retain_until')) {
                $table->date('retain_until')->nullable()->after('retention_policy');
            }
            if (! Schema::hasColumn('correspondence', 'legal_hold')) {
                $table->boolean('legal_hold')->default(false)->after('retain_until');
            }
            if (! Schema::hasColumn('correspondence', 'legal_hold_reason')) {
                $table->text('legal_hold_reason')->nullable()->after('legal_hold');
            }
            if (! Schema::hasColumn('correspondence', 'legal_hold_set_by')) {
                $table->foreignId('legal_hold_set_by')->nullable()->after('legal_hold_reason')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('correspondence', 'legal_hold_set_at')) {
                $table->timestamp('legal_hold_set_at')->nullable()->after('legal_hold_set_by');
            }
            if (! Schema::hasColumn('correspondence', 'purged_at')) {
                $table->timestamp('purged_at')->nullable()->after('legal_hold_set_at');
            }
            if (! Schema::hasColumn('correspondence', 'purged_by')) {
                $table->foreignId('purged_by')->nullable()->after('purged_at')->constrained('users')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('correspondence', function (Blueprint $table) {
            foreach (['purged_by', 'legal_hold_set_by'] as $fk) {
                if (Schema::hasColumn('correspondence', $fk)) {
                    $table->dropConstrainedForeignId($fk);
                }
            }
            foreach (['purged_at', 'legal_hold_set_at', 'legal_hold_reason', 'legal_hold', 'retain_until', 'retention_policy'] as $col) {
                if (Schema::hasColumn('correspondence', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
