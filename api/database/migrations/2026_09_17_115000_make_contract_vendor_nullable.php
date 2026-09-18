<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Individual counterparties (interpreters, rapporteurs, resource persons,
 * consultants) have no supplier/vendor record, so a contract must be able to
 * exist without a vendor_id. The FK is retained (it already permits NULL).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE contracts ALTER COLUMN vendor_id DROP NOT NULL');
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            // Only re-apply NOT NULL when no rows would violate it.
            $nullCount = (int) DB::table('contracts')->whereNull('vendor_id')->count();
            if ($nullCount === 0) {
                DB::statement('ALTER TABLE contracts ALTER COLUMN vendor_id SET NOT NULL');
            }
        }
    }
};
