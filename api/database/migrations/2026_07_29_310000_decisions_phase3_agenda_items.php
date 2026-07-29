<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meeting_agenda_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workplan_event_id')->nullable()->constrained('workplan_events')->nullOnDelete();
            $table->foreignId('meeting_minutes_id')->nullable()->constrained('meeting_minutes')->nullOnDelete();
            $table->foreignId('meeting_decision_id')->nullable()->constrained('meeting_decisions')->nullOnDelete();
            $table->unsignedSmallInteger('sequence')->default(1);
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('status', 24)->default('open'); // open|discussed|deferred|closed
            $table->foreignId('presenter_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'workplan_event_id']);
            $table->index(['tenant_id', 'meeting_decision_id']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::table('meeting_decisions', function (Blueprint $table) {
            if (! Schema::hasColumn('meeting_decisions', 'agenda_item_id')) {
                $table->foreignId('agenda_item_id')->nullable()->after('workplan_event_id')
                    ->constrained('meeting_agenda_items')->nullOnDelete();
            }
            if (! Schema::hasColumn('meeting_decisions', 'last_promoted_at')) {
                $table->timestamp('last_promoted_at')->nullable()->after('source_purpose');
            }
        });
    }

    public function down(): void
    {
        Schema::table('meeting_decisions', function (Blueprint $table) {
            if (Schema::hasColumn('meeting_decisions', 'agenda_item_id')) {
                $table->dropConstrainedForeignId('agenda_item_id');
            }
            if (Schema::hasColumn('meeting_decisions', 'last_promoted_at')) {
                $table->dropColumn('last_promoted_at');
            }
        });
        Schema::dropIfExists('meeting_agenda_items');
    }
};
