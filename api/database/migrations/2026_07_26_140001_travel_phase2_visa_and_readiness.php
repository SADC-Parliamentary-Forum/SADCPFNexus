<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('travel_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('travel_requests', 'visa_required')) {
                $table->boolean('visa_required')->default(false)->after('terminal_comms_total');
            }
            if (! Schema::hasColumn('travel_requests', 'visa_status')) {
                $table->string('visa_status')->nullable()->after('visa_required');
                // not_required | pending | appointment_scheduled | submitted | approved | rejected | expired
            }
            if (! Schema::hasColumn('travel_requests', 'visa_expiry_date')) {
                $table->date('visa_expiry_date')->nullable()->after('visa_status');
            }
            if (! Schema::hasColumn('travel_requests', 'visa_appointment_date')) {
                $table->date('visa_appointment_date')->nullable()->after('visa_expiry_date');
            }
            if (! Schema::hasColumn('travel_requests', 'visa_notes')) {
                $table->text('visa_notes')->nullable()->after('visa_appointment_date');
            }
            if (! Schema::hasColumn('travel_requests', 'visa_last_reminded_at')) {
                $table->timestamp('visa_last_reminded_at')->nullable()->after('visa_notes');
            }
        });
    }

    public function down(): void
    {
        Schema::table('travel_requests', function (Blueprint $table) {
            foreach ([
                'visa_required', 'visa_status', 'visa_expiry_date',
                'visa_appointment_date', 'visa_notes', 'visa_last_reminded_at',
            ] as $col) {
                if (Schema::hasColumn('travel_requests', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
