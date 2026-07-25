<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('me_activity_reports', function (Blueprint $table) {
            $table->timestamp('intake_confirmed_at')->nullable()->after('created_by');
            $table->timestamp('report_due_at')->nullable()->after('intake_confirmed_at');
            $table->string('return_section', 100)->nullable()->after('review_notes');
            $table->text('return_required_action')->nullable()->after('return_section');
            $table->timestamp('correction_due_at')->nullable()->after('return_required_action');
            $table->text('not_reportable_reason')->nullable()->after('correction_due_at');
            $table->foreignId('not_reportable_by')->nullable()->after('not_reportable_reason')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('not_reportable_at')->nullable()->after('not_reportable_by');
            $table->text('cancelled_reason')->nullable()->after('not_reportable_at');
            $table->timestamp('archived_at')->nullable()->after('cancelled_reason');
        });
    }

    public function down(): void
    {
        Schema::table('me_activity_reports', function (Blueprint $table) {
            $table->dropConstrainedForeignId('not_reportable_by');
            $table->dropColumn([
                'intake_confirmed_at',
                'report_due_at',
                'return_section',
                'return_required_action',
                'correction_due_at',
                'not_reportable_reason',
                'not_reportable_at',
                'cancelled_reason',
                'archived_at',
            ]);
        });
    }
};
