<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('travel_toil_candidates') && ! Schema::hasColumn('travel_toil_candidates', 'sg_extend_reason')) {
            Schema::table('travel_toil_candidates', function (Blueprint $table) {
                $table->text('sg_extend_reason')->nullable()->after('sg_extended_by');
            });
        }

        if (! Schema::hasTable('travel_toil_candidates')) {
            return;
        }

        // Remap Phase-1 statuses to Auto-TOIL approval states.
        $map = [
            'candidate' => 'pending_supervisor',
            'ot_authorised' => 'pending_supervisor',
            'duty_confirmed' => 'pending_hr',
            'hr_validated' => 'credited',
            'lapsed' => 'expired',
        ];

        foreach ($map as $from => $to) {
            DB::table('travel_toil_candidates')->where('status', $from)->update(['status' => $to]);
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('travel_toil_candidates') && Schema::hasColumn('travel_toil_candidates', 'sg_extend_reason')) {
            Schema::table('travel_toil_candidates', function (Blueprint $table) {
                $table->dropColumn('sg_extend_reason');
            });
        }
    }
};
