<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Historical leave sources (Sage VIP exports) carry 4-decimal-place day values
 * (e.g. 47.8310) that decimal(8,2)/decimal(10,2) and the integer
 * annual_balance_days/sick_leave_used_days columns cannot represent without
 * truncation. Widening to decimal(12,4) is a safe, backward-compatible
 * expansion — existing 0/1/2-decimal values are unaffected.
 *
 * Also adds leave_type_balances: a per-(user, leave_type, period_year)
 * balance snapshot table so every historical leave type (not just annual,
 * which is all the narrow leave_balances table supports) has a first-class
 * stored balance. Additive — does not replace leave_balances, which other
 * live code may already depend on for its exact shape.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('leave_balances')) {
            Schema::table('leave_balances', function (Blueprint $table) {
                $table->decimal('annual_balance_days', 12, 4)->default(0)->change();
                $table->decimal('sick_leave_used_days', 12, 4)->default(0)->change();
            });
        }

        if (Schema::hasTable('leave_segments')) {
            Schema::table('leave_segments', function (Blueprint $table) {
                $table->decimal('calendar_days', 12, 4)->default(0)->change();
                $table->decimal('weekend_days', 12, 4)->default(0)->change();
                $table->decimal('public_holidays_excluded', 12, 4)->default(0)->change();
                $table->decimal('working_days', 12, 4)->default(0)->change();
                $table->decimal('balance_before', 12, 4)->nullable()->change();
                $table->decimal('amount_requested', 12, 4)->default(0)->change();
                $table->decimal('balance_after', 12, 4)->nullable()->change();
            });
        }

        if (Schema::hasTable('leave_ledger_entries')) {
            Schema::table('leave_ledger_entries', function (Blueprint $table) {
                $table->decimal('amount', 12, 4)->change();
                $table->decimal('balance_after', 12, 4)->nullable()->change();
            });
        }

        Schema::create('leave_type_balances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('leave_type_id')->nullable()->constrained('leave_types')->nullOnDelete();
            $table->string('leave_type', 40);
            $table->unsignedSmallInteger('period_year');
            $table->decimal('entitlement', 12, 4)->default(0);
            $table->decimal('balance_brought_forward', 12, 4)->default(0);
            $table->decimal('accrued', 12, 4)->default(0);
            $table->decimal('taken', 12, 4)->default(0);
            $table->decimal('balance_carried_forward', 12, 4)->default(0);
            $table->string('source', 40)->nullable();
            $table->timestamp('imported_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'user_id', 'leave_type', 'period_year'], 'leave_type_balances_unique');
        });

        if (DB::getDriverName() === 'pgsql') {
            $this->grantIfExists('leave_type_balances');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_type_balances');
        // Precision widening on existing columns is intentionally left in place —
        // narrowing back would truncate any historical data already imported.
    }

    private function grantIfExists(string $table): void
    {
        $exists = DB::selectOne(
            "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?",
            [$table]
        );
        if (! $exists) {
            return;
        }
        DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO app_user");
        DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
    }
};
