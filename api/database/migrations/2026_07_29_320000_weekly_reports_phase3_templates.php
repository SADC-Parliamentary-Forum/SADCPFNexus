<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('weekly_reports', function (Blueprint $table) {
            if (! Schema::hasColumn('weekly_reports', 'donor_code')) {
                $table->string('donor_code', 64)->nullable()->after('project_id');
            }
            if (! Schema::hasColumn('weekly_reports', 'donor_name')) {
                $table->string('donor_name', 255)->nullable()->after('donor_code');
            }
            if (! Schema::hasColumn('weekly_reports', 'template_key')) {
                $table->string('template_key', 64)->nullable()->after('donor_name');
            }
            if (! Schema::hasColumn('weekly_reports', 'ai_draft_text')) {
                $table->text('ai_draft_text')->nullable()->after('additional_notes');
            }
            if (! Schema::hasColumn('weekly_reports', 'ai_draft_confirmed_at')) {
                $table->timestamp('ai_draft_confirmed_at')->nullable()->after('ai_draft_text');
            }
            if (! Schema::hasColumn('weekly_reports', 'ai_draft_confirmed_by')) {
                $table->foreignId('ai_draft_confirmed_by')->nullable()->after('ai_draft_confirmed_at')
                    ->constrained('users')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('weekly_reports', function (Blueprint $table) {
            foreach (['ai_draft_confirmed_by', 'ai_draft_confirmed_at', 'ai_draft_text', 'template_key', 'donor_name', 'donor_code'] as $col) {
                if (Schema::hasColumn('weekly_reports', $col)) {
                    if ($col === 'ai_draft_confirmed_by') {
                        $table->dropConstrainedForeignId($col);
                    } else {
                        $table->dropColumn($col);
                    }
                }
            }
        });
    }
};
