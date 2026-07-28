<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            if (! Schema::hasColumn('assignments', 'source_type')) {
                $table->string('source_type', 64)->default('manual')->after('meeting_minutes_id');
            }
            if (! Schema::hasColumn('assignments', 'source_id')) {
                $table->unsignedBigInteger('source_id')->nullable()->after('source_type');
            }
            if (! Schema::hasColumn('assignments', 'source_reference')) {
                $table->string('source_reference')->nullable()->after('source_id');
            }
            if (! Schema::hasColumn('assignments', 'source_title')) {
                $table->string('source_title')->nullable()->after('source_reference');
            }
            if (! Schema::hasColumn('assignments', 'source_purpose')) {
                $table->string('source_purpose', 120)->nullable()->after('source_title');
            }
            if (! Schema::hasColumn('assignments', 'acceptance_criteria')) {
                $table->text('acceptance_criteria')->nullable()->after('expected_output');
            }
            if (! Schema::hasColumn('assignments', 'evidence_required')) {
                $table->boolean('evidence_required')->default(false)->after('acceptance_criteria');
            }
            if (! Schema::hasColumn('assignments', 'completion_instructions')) {
                $table->text('completion_instructions')->nullable()->after('evidence_required');
            }
            if (! Schema::hasColumn('assignments', 'review_required')) {
                $table->boolean('review_required')->default(false)->after('is_confidential');
            }
            if (! Schema::hasColumn('assignments', 'reviewer_id')) {
                $table->foreignId('reviewer_id')->nullable()->after('review_required')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('assignments', 'review_status')) {
                $table->string('review_status', 40)->default('none')->after('reviewer_id');
            }
            if (! Schema::hasColumn('assignments', 'verified_at')) {
                $table->timestamp('verified_at')->nullable()->after('review_status');
            }
            if (! Schema::hasColumn('assignments', 'verified_by')) {
                $table->foreignId('verified_by')->nullable()->after('verified_at')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('assignments', 'verification_notes')) {
                $table->text('verification_notes')->nullable()->after('verified_by');
            }
            if (! Schema::hasColumn('assignments', 'blocker_owner_id')) {
                $table->foreignId('blocker_owner_id')->nullable()->after('blocker_details')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('assignments', 'blocker_expected_resolution_at')) {
                $table->timestamp('blocker_expected_resolution_at')->nullable()->after('blocker_owner_id');
            }
            if (! Schema::hasColumn('assignments', 'department_claim_due_at')) {
                $table->timestamp('department_claim_due_at')->nullable()->after('department_id');
            }
            if (! Schema::hasColumn('assignments', 'claimed_at')) {
                $table->timestamp('claimed_at')->nullable()->after('department_claim_due_at');
            }
            if (! Schema::hasColumn('assignments', 'parent_id')) {
                $table->foreignId('parent_id')->nullable()->after('id')->constrained('assignments')->nullOnDelete();
            }
            if (! Schema::hasColumn('assignments', 'is_template')) {
                $table->boolean('is_template')->default(false)->after('type');
            }
            if (! Schema::hasColumn('assignments', 'template_id')) {
                $table->foreignId('template_id')->nullable()->after('is_template')->constrained('assignments')->nullOnDelete();
            }
            if (! Schema::hasColumn('assignments', 'recurrence_rule')) {
                $table->json('recurrence_rule')->nullable()->after('template_id');
            }
            if (! Schema::hasColumn('assignments', 'recurrence_next_run_at')) {
                $table->timestamp('recurrence_next_run_at')->nullable()->after('recurrence_rule');
            }
            if (! Schema::hasColumn('assignments', 'escalation_level')) {
                $table->unsignedTinyInteger('escalation_level')->default(0)->after('progress_percent');
            }
            if (! Schema::hasColumn('assignments', 'last_reminded_at')) {
                $table->timestamp('last_reminded_at')->nullable()->after('escalation_level');
            }
            if (! Schema::hasColumn('assignments', 'last_escalated_at')) {
                $table->timestamp('last_escalated_at')->nullable()->after('last_reminded_at');
            }
            if (! Schema::hasColumn('assignments', 'acted_via_delegation_id')) {
                $table->unsignedBigInteger('acted_via_delegation_id')->nullable()->after('last_escalated_at');
            }
        });

        // Unique idempotency for source-linked assignments (nullable source_id allowed for manual).
        if (! $this->indexExists('assignments', 'assignments_source_idempotent_unique')) {
            Schema::table('assignments', function (Blueprint $table) {
                $table->unique(
                    ['tenant_id', 'source_type', 'source_id', 'source_purpose'],
                    'assignments_source_idempotent_unique'
                );
            });
        }

        Schema::table('assignments', function (Blueprint $table) {
            $table->index(['tenant_id', 'assigned_to', 'status'], 'assignments_tenant_assignee_status_idx');
            $table->index(['tenant_id', 'reviewer_id', 'review_status'], 'assignments_tenant_reviewer_idx');
            $table->index(['tenant_id', 'source_type', 'source_id'], 'assignments_tenant_source_idx');
            $table->index(['tenant_id', 'due_date', 'status'], 'assignments_tenant_due_status_idx');
        });

        Schema::create('assignment_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('assignment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role', 32); // contributor | watcher | reviewer
            $table->timestamps();

            $table->unique(['assignment_id', 'user_id', 'role'], 'assignment_participant_unique');
            $table->index(['tenant_id', 'user_id', 'role']);
        });

        Schema::create('assignment_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('assignment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event_type', 64);
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('acted_via_delegation_id')->nullable();
            $table->timestamps();

            $table->index(['assignment_id', 'created_at']);
            $table->index(['tenant_id', 'event_type']);
        });

        Schema::create('assignment_checklist_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('assignment_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('sequence')->default(0);
            $table->boolean('mandatory')->default(false);
            $table->foreignId('assignee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('due_at')->nullable();
            $table->boolean('completed')->default(false);
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->unsignedBigInteger('evidence_document_id')->nullable();
            $table->timestamps();

            $table->index(['assignment_id', 'sequence']);
        });

        Schema::create('assignment_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('assignment_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('submission_version')->default(1);
            $table->foreignId('reviewer_id')->constrained('users')->cascadeOnDelete();
            $table->string('decision', 40); // accepted | returned | request_evidence | accepted_with_follow_up
            $table->text('comments')->nullable();
            $table->json('acceptance_criteria_results')->nullable();
            $table->boolean('follow_up_required')->default(false);
            $table->timestamp('reviewed_at');
            $table->timestamps();

            $table->index(['assignment_id', 'submission_version']);
        });

        Schema::create('assignment_reminders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('assignment_id')->constrained()->cascadeOnDelete();
            $table->string('reminder_type', 40); // due_soon | due_today | overdue | acceptance | escalation
            $table->timestamp('scheduled_for');
            $table->timestamp('sent_at')->nullable();
            $table->string('status', 20)->default('pending'); // pending | sent | cancelled
            $table->unsignedTinyInteger('escalation_level')->default(0);
            $table->timestamps();

            $table->index(['status', 'scheduled_for']);
            $table->index(['assignment_id', 'reminder_type']);
        });

        // Widen blocker_type / priority storage if backed by enum/check (Postgres).
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_blocker_type_check');
            DB::statement('ALTER TABLE assignment_updates DROP CONSTRAINT IF EXISTS assignment_updates_blocker_type_check');
            DB::statement('ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_priority_check');
            DB::statement('ALTER TABLE assignments ALTER COLUMN blocker_type TYPE varchar(64) USING blocker_type::text');
            DB::statement('ALTER TABLE assignment_updates ALTER COLUMN blocker_type TYPE varchar(64) USING blocker_type::text');
            DB::statement('ALTER TABLE assignments ALTER COLUMN priority TYPE varchar(32) USING priority::text');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('assignment_reminders');
        Schema::dropIfExists('assignment_reviews');
        Schema::dropIfExists('assignment_checklist_items');
        Schema::dropIfExists('assignment_events');
        Schema::dropIfExists('assignment_participants');

        Schema::table('assignments', function (Blueprint $table) {
            foreach ([
                'assignments_tenant_assignee_status_idx',
                'assignments_tenant_reviewer_idx',
                'assignments_tenant_source_idx',
                'assignments_tenant_due_status_idx',
                'assignments_source_idempotent_unique',
            ] as $index) {
                try {
                    $table->dropIndex($index);
                } catch (\Throwable) {
                    // ignore
                }
            }

            $cols = [
                'source_type', 'source_id', 'source_reference', 'source_title', 'source_purpose',
                'acceptance_criteria', 'evidence_required', 'completion_instructions',
                'review_required', 'reviewer_id', 'review_status', 'verified_at', 'verified_by', 'verification_notes',
                'blocker_owner_id', 'blocker_expected_resolution_at',
                'department_claim_due_at', 'claimed_at',
                'parent_id', 'is_template', 'template_id', 'recurrence_rule', 'recurrence_next_run_at',
                'escalation_level', 'last_reminded_at', 'last_escalated_at', 'acted_via_delegation_id',
            ];
            foreach ($cols as $col) {
                if (Schema::hasColumn('assignments', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }

    private function indexExists(string $table, string $index): bool
    {
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'pgsql') {
            $row = DB::selectOne('SELECT 1 AS ok FROM pg_indexes WHERE tablename = ? AND indexname = ?', [$table, $index]);

            return (bool) $row;
        }
        if ($driver === 'sqlite') {
            $rows = DB::select("PRAGMA index_list('{$table}')");
            foreach ($rows as $r) {
                if (($r->name ?? null) === $index) {
                    return true;
                }
            }
        }

        return false;
    }
};
