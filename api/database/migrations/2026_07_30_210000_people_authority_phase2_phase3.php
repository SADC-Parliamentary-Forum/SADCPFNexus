<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('signature_enrolments')) {
            Schema::table('signature_enrolments', function (Blueprint $table) {
                if (! Schema::hasColumn('signature_enrolments', 'certificate_subject')) {
                    $table->string('certificate_subject')->nullable();
                }
                if (! Schema::hasColumn('signature_enrolments', 'certificate_thumbprint')) {
                    $table->string('certificate_thumbprint', 128)->nullable();
                }
                if (! Schema::hasColumn('signature_enrolments', 'certificate_expires_at')) {
                    $table->timestamp('certificate_expires_at')->nullable();
                }
                if (! Schema::hasColumn('signature_enrolments', 'certificate_meta')) {
                    $table->json('certificate_meta')->nullable();
                }
            });
        }

        if (Schema::hasTable('document_signature_events')) {
            Schema::table('document_signature_events', function (Blueprint $table) {
                if (! Schema::hasColumn('document_signature_events', 'public_verification_token')) {
                    $table->string('public_verification_token', 64)->nullable()->unique();
                }
                if (! Schema::hasColumn('document_signature_events', 'esign_provider')) {
                    $table->string('esign_provider', 64)->nullable();
                }
                if (! Schema::hasColumn('document_signature_events', 'esign_external_id')) {
                    $table->string('esign_external_id')->nullable();
                }
                if (! Schema::hasColumn('document_signature_events', 'published_for_verification_at')) {
                    $table->timestamp('published_for_verification_at')->nullable();
                }
            });
        }

        if (Schema::hasTable('employment_records')) {
            Schema::table('employment_records', function (Blueprint $table) {
                if (! Schema::hasColumn('employment_records', 'payroll_identifier')) {
                    $table->string('payroll_identifier')->nullable()->index();
                }
                if (! Schema::hasColumn('employment_records', 'payroll_export_status')) {
                    $table->string('payroll_export_status', 32)->nullable();
                }
                if (! Schema::hasColumn('employment_records', 'payroll_last_exported_at')) {
                    $table->timestamp('payroll_last_exported_at')->nullable();
                }
            });
        }

        if (Schema::hasTable('access_review_campaigns')) {
            Schema::table('access_review_campaigns', function (Blueprint $table) {
                if (! Schema::hasColumn('access_review_campaigns', 'campaign_type')) {
                    $table->string('campaign_type', 32)->default('manual');
                }
                if (! Schema::hasColumn('access_review_campaigns', 'recurrence')) {
                    $table->string('recurrence', 32)->nullable();
                }
                if (! Schema::hasColumn('access_review_campaigns', 'auto_populate_roles')) {
                    $table->boolean('auto_populate_roles')->default(false);
                }
                if (! Schema::hasColumn('access_review_campaigns', 'last_auto_opened_at')) {
                    $table->timestamp('last_auto_opened_at')->nullable();
                }
            });
        }

        Schema::create('people_esign_requests', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('document_type');
            $table->unsignedBigInteger('document_id');
            $table->string('document_version_id')->nullable();
            $table->string('document_hash', 128);
            $table->string('provider', 64);
            $table->string('external_id')->nullable();
            $table->string('status', 32)->default('draft'); // draft|submitted|completed|failed|cancelled
            $table->json('recipients')->nullable();
            $table->json('provider_payload')->nullable();
            $table->json('provider_response')->nullable();
            $table->unsignedBigInteger('requested_by')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['document_type', 'document_id']);
        });

        Schema::create('people_directory_sync_runs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('driver', 64);
            $table->boolean('dry_run')->default(true);
            $table->string('status', 32)->default('pending'); // pending|running|completed|failed
            $table->unsignedInteger('fetched_count')->default(0);
            $table->unsignedInteger('matched_count')->default(0);
            $table->unsignedInteger('created_count')->default(0);
            $table->unsignedInteger('updated_count')->default(0);
            $table->unsignedInteger('skipped_count')->default(0);
            $table->json('summary')->nullable();
            $table->text('error_message')->nullable();
            $table->unsignedBigInteger('started_by')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });

        Schema::create('people_org_scenarios', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('name');
            $table->string('status', 32)->default('draft'); // draft|archived
            $table->text('description')->nullable();
            $table->json('structure')->nullable();
            $table->unsignedBigInteger('based_on_snapshot_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('people_sod_conflict_reports', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('title');
            $table->string('status', 32)->default('open'); // open|acknowledged|closed
            $table->unsignedInteger('conflict_count')->default(0);
            $table->json('conflicts')->nullable();
            $table->json('rule_snapshot')->nullable();
            $table->unsignedBigInteger('generated_by')->nullable();
            $table->timestamp('generated_at')->nullable();
            $table->unsignedBigInteger('acknowledged_by')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamps();
        });

        Schema::create('people_succession_plans', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('position_id')->index();
            $table->string('title')->nullable();
            $table->string('status', 32)->default('draft'); // draft|active|archived
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('people_succession_candidates', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('succession_plan_id')->index();
            $table->unsignedBigInteger('person_id')->index();
            $table->string('readiness', 32)->default('developing'); // ready|developing|long_term
            $table->unsignedTinyInteger('rank')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['succession_plan_id', 'person_id'], 'pa_succ_cand_unique');
        });

        Schema::create('people_skills', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->nullable()->index();
            $table->string('code', 64);
            $table->string('name');
            $table->string('category', 64)->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['tenant_id', 'code'], 'pa_skills_tenant_code_unique');
        });

        Schema::create('people_person_skills', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('person_id')->index();
            $table->unsignedBigInteger('skill_id')->index();
            $table->string('level', 32)->default('working'); // awareness|working|proficient|expert
            $table->date('assessed_on')->nullable();
            $table->text('evidence_notes')->nullable();
            $table->unsignedBigInteger('recorded_by')->nullable();
            $table->timestamps();
            $table->unique(['person_id', 'skill_id'], 'pa_person_skills_unique');
        });

        Schema::create('people_ai_suggestions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('kind', 64);
            $table->string('provider', 32)->default('stub');
            $table->string('status', 32)->default('pending_confirmation');
            $table->boolean('auto_applied')->default(false);
            $table->json('input_context')->nullable();
            $table->json('suggestion')->nullable();
            $table->string('applied_action')->nullable();
            $table->text('apply_note')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('applied_by')->nullable();
            $table->timestamp('applied_at')->nullable();
            $table->timestamps();
        });

        Schema::create('people_privilege_alerts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('person_id')->nullable()->index();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('alert_type', 64);
            $table->string('severity', 16)->default('medium'); // low|medium|high
            $table->string('status', 32)->default('open'); // open|acknowledged|dismissed
            $table->json('details')->nullable();
            $table->unsignedBigInteger('detected_by')->nullable(); // null = system
            $table->timestamp('detected_at')->nullable();
            $table->unsignedBigInteger('acknowledged_by')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('people_privilege_alerts');
        Schema::dropIfExists('people_ai_suggestions');
        Schema::dropIfExists('people_person_skills');
        Schema::dropIfExists('people_skills');
        Schema::dropIfExists('people_succession_candidates');
        Schema::dropIfExists('people_succession_plans');
        Schema::dropIfExists('people_sod_conflict_reports');
        Schema::dropIfExists('people_org_scenarios');
        Schema::dropIfExists('people_directory_sync_runs');
        Schema::dropIfExists('people_esign_requests');

        if (Schema::hasTable('access_review_campaigns')) {
            Schema::table('access_review_campaigns', function (Blueprint $table) {
                foreach (['campaign_type', 'recurrence', 'auto_populate_roles', 'last_auto_opened_at'] as $col) {
                    if (Schema::hasColumn('access_review_campaigns', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        if (Schema::hasTable('employment_records')) {
            Schema::table('employment_records', function (Blueprint $table) {
                foreach (['payroll_identifier', 'payroll_export_status', 'payroll_last_exported_at'] as $col) {
                    if (Schema::hasColumn('employment_records', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        if (Schema::hasTable('document_signature_events')) {
            Schema::table('document_signature_events', function (Blueprint $table) {
                foreach (['public_verification_token', 'esign_provider', 'esign_external_id', 'published_for_verification_at'] as $col) {
                    if (Schema::hasColumn('document_signature_events', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        if (Schema::hasTable('signature_enrolments')) {
            Schema::table('signature_enrolments', function (Blueprint $table) {
                foreach (['certificate_subject', 'certificate_thumbprint', 'certificate_expires_at', 'certificate_meta'] as $col) {
                    if (Schema::hasColumn('signature_enrolments', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }
    }
};
