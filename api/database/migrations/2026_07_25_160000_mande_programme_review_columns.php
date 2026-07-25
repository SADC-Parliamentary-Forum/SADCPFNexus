<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('me_activity_reports', function (Blueprint $table) {
            $table->string('programme_review_status', 32)->nullable()->after('report_due_at');
            $table->foreignId('programme_reviewed_by')->nullable()->after('programme_review_status')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('programme_reviewed_at')->nullable()->after('programme_reviewed_by');
            $table->text('programme_review_notes')->nullable()->after('programme_reviewed_at');
            $table->index(['tenant_id', 'programme_review_status']);
        });
    }

    public function down(): void
    {
        Schema::table('me_activity_reports', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'programme_review_status']);
            $table->dropConstrainedForeignId('programme_reviewed_by');
            $table->dropColumn([
                'programme_review_status',
                'programme_reviewed_at',
                'programme_review_notes',
            ]);
        });
    }
};
