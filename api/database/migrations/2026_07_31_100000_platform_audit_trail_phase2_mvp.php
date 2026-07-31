<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Platform Audit Trail Phase 2 MVP — monitoring rules, alert workflow, forensic packages.
 * SIEM / WORM / AI remain Governance Configuration Pending (no invented vendor).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('security_monitoring_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('rule_key', 64);
            $table->unsignedSmallInteger('version')->default(1);
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('event_key_pattern', 512);
            $table->string('severity', 32)->default('high');
            $table->unsignedInteger('threshold_count')->default(1);
            $table->unsignedInteger('window_minutes')->default(60);
            $table->boolean('enabled')->default(true);
            $table->string('status', 32)->default('active'); // draft|active|retired
            $table->json('meta')->nullable();
            $table->foreignId('published_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'rule_key', 'version'], 'sec_mon_rule_tenant_key_ver_uq');
            $table->index(['enabled', 'status']);
        });

        Schema::table('audit_event_alerts', function (Blueprint $table) {
            if (! Schema::hasColumn('audit_event_alerts', 'rule_id')) {
                $table->foreignId('rule_id')->nullable()->after('tenant_id')
                    ->constrained('security_monitoring_rules')->nullOnDelete();
            }
            if (! Schema::hasColumn('audit_event_alerts', 'classification')) {
                $table->string('classification', 64)->nullable()->after('status');
            }
            if (! Schema::hasColumn('audit_event_alerts', 'reviewed_by')) {
                $table->foreignId('reviewed_by')->nullable()->after('classification')
                    ->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('audit_event_alerts', 'reviewed_at')) {
                $table->timestamp('reviewed_at')->nullable()->after('reviewed_by');
            }
            if (! Schema::hasColumn('audit_event_alerts', 'workflow_status')) {
                // new|under_review|classified|closed — parallel to status for MVP clarity
                $table->string('workflow_status', 32)->default('new')->after('reviewed_at');
            }
            if (! Schema::hasColumn('audit_event_alerts', 'event_ids')) {
                $table->json('event_ids')->nullable()->after('first_event_id');
            }
        });

        Schema::create('forensic_case_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('forensic_case_id')->constrained('forensic_cases')->cascadeOnDelete();
            $table->foreignId('audit_event_id')->constrained('audit_events')->cascadeOnDelete();
            $table->foreignId('linked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('linked_at');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['forensic_case_id', 'audit_event_id'], 'forensic_case_event_uq');
        });

        Schema::create('forensic_evidence_packages', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('forensic_case_id')->constrained('forensic_cases')->cascadeOnDelete();
            $table->string('reference', 64);
            $table->string('manifest_hash', 128);
            $table->json('manifest');
            $table->unsignedInteger('event_count')->default(0);
            $table->string('status', 32)->default('sealed'); // sealed|verified|superseded
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('sealed_at');
            $table->timestamps();

            $table->unique(['tenant_id', 'reference']);
        });

        Schema::table('forensic_cases', function (Blueprint $table) {
            if (! Schema::hasColumn('forensic_cases', 'custody_holder_id')) {
                $table->foreignId('custody_holder_id')->nullable()->after('opened_by')
                    ->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('forensic_cases', 'custody_notes')) {
                $table->text('custody_notes')->nullable()->after('notes');
            }
            if (! Schema::hasColumn('forensic_cases', 'closed_at')) {
                $table->timestamp('closed_at')->nullable()->after('custody_notes');
            }
            if (! Schema::hasColumn('forensic_cases', 'closed_by')) {
                $table->foreignId('closed_by')->nullable()->after('closed_at')
                    ->constrained('users')->nullOnDelete();
            }
        });

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON security_monitoring_rules TO CURRENT_USER');
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON forensic_case_events TO CURRENT_USER');
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON forensic_evidence_packages TO CURRENT_USER');
            try {
                DB::statement('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO CURRENT_USER');
            } catch (\Throwable) {
                // ignore when role lacks GRANT OPTION in local sqlite etc.
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('forensic_evidence_packages');
        Schema::dropIfExists('forensic_case_events');

        Schema::table('audit_event_alerts', function (Blueprint $table) {
            foreach (['rule_id', 'classification', 'reviewed_by', 'reviewed_at', 'workflow_status', 'event_ids'] as $col) {
                if (Schema::hasColumn('audit_event_alerts', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('forensic_cases', function (Blueprint $table) {
            foreach (['custody_holder_id', 'custody_notes', 'closed_at', 'closed_by'] as $col) {
                if (Schema::hasColumn('forensic_cases', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::dropIfExists('security_monitoring_rules');
    }
};
