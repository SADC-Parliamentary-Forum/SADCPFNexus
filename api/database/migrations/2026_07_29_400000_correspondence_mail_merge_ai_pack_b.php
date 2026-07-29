<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('correspondence_letter_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('code', 64);
            $table->string('subject_template', 500);
            $table->text('body_template');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'code']);
        });

        Schema::table('correspondence', function (Blueprint $table) {
            if (! Schema::hasColumn('correspondence', 'ai_draft_subject')) {
                $table->string('ai_draft_subject', 500)->nullable()->after('body');
            }
            if (! Schema::hasColumn('correspondence', 'ai_draft_body')) {
                $table->text('ai_draft_body')->nullable()->after('ai_draft_subject');
            }
            if (! Schema::hasColumn('correspondence', 'ai_draft_confirmed_at')) {
                $table->timestamp('ai_draft_confirmed_at')->nullable()->after('ai_draft_body');
            }
            if (! Schema::hasColumn('correspondence', 'ai_draft_confirmed_by')) {
                $table->foreignId('ai_draft_confirmed_by')->nullable()->after('ai_draft_confirmed_at')
                    ->constrained('users')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('correspondence', function (Blueprint $table) {
            foreach (['ai_draft_confirmed_by', 'ai_draft_confirmed_at', 'ai_draft_body', 'ai_draft_subject'] as $col) {
                if (Schema::hasColumn('correspondence', $col)) {
                    if ($col === 'ai_draft_confirmed_by') {
                        $table->dropConstrainedForeignId('ai_draft_confirmed_by');
                    } else {
                        $table->dropColumn($col);
                    }
                }
            }
        });

        Schema::dropIfExists('correspondence_letter_templates');
    }
};
