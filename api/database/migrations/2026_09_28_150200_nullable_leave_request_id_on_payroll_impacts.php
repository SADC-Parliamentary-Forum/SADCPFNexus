<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * leave_payroll_impacts.leave_request_id was required, assuming every row traces to one
 * approved LeaveRequest. Historical "leave provision movement" snapshots imported from Sage
 * VIP are period-level financial aggregates per employee, not tied to a single request —
 * make the FK nullable so those snapshots can be stored without inventing a fake request.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leave_payroll_impacts', function (Blueprint $table) {
            $table->foreignId('leave_request_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('leave_payroll_impacts', function (Blueprint $table) {
            $table->foreignId('leave_request_id')->nullable(false)->change();
        });
    }
};
