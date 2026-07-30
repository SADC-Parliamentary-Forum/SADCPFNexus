<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('people', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('person_number')->nullable()->index();
            $table->string('title', 32)->nullable();
            $table->string('first_name');
            $table->string('middle_name')->nullable();
            $table->string('last_name');
            $table->string('preferred_name')->nullable();
            $table->string('display_name')->nullable();
            $table->string('person_type', 32)->default('employee'); // employee|contractor|guest|external|service_ref
            $table->string('employment_status', 32)->default('active');
            $table->string('work_email')->nullable()->index();
            $table->string('work_phone', 64)->nullable();
            $table->string('mobile_phone', 64)->nullable();
            $table->string('office_location')->nullable();
            $table->unsignedBigInteger('primary_unit_id')->nullable()->index();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->boolean('directory_visible')->default(true);
            $table->string('photo_path')->nullable();
            $table->json('directory_meta')->nullable();
            $table->json('operational_meta')->nullable(); // non-confidential operational
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['tenant_id', 'person_number']);
        });

        Schema::create('person_confidential_profiles', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('person_id')->unique();
            $table->date('date_of_birth')->nullable();
            $table->string('national_id')->nullable();
            $table->string('passport_number')->nullable();
            $table->string('nationality')->nullable();
            $table->string('gender', 32)->nullable();
            $table->string('marital_status', 32)->nullable();
            $table->string('home_address_line1')->nullable();
            $table->string('home_address_line2')->nullable();
            $table->string('home_city')->nullable();
            $table->string('home_country')->nullable();
            $table->string('emergency_contact_name')->nullable();
            $table->string('emergency_contact_relationship')->nullable();
            $table->string('emergency_contact_phone', 64)->nullable();
            $table->json('medical_notes')->nullable();
            $table->json('bank_details_encrypted')->nullable();
            $table->json('extra')->nullable();
            $table->timestamps();
        });

        Schema::create('person_user_links', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('person_id')->index();
            $table->unsignedBigInteger('user_id')->index();
            $table->string('link_type', 32)->default('primary'); // primary|historical|service
            $table->string('status', 32)->default('active');
            $table->timestamp('linked_at')->nullable();
            $table->timestamp('unlinked_at')->nullable();
            $table->unsignedBigInteger('linked_by')->nullable();
            $table->timestamps();
            $table->unique(['person_id', 'user_id']);
        });

        Schema::create('employment_records', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('person_id')->index();
            $table->string('employee_number')->nullable()->index();
            $table->string('contract_type', 64)->nullable();
            $table->string('grade')->nullable();
            $table->date('hire_date')->nullable();
            $table->date('probation_end')->nullable();
            $table->date('termination_date')->nullable();
            $table->string('status', 32)->default('active');
            $table->json('meta')->nullable();
            $table->timestamps();
        });

        Schema::create('organisational_units', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('code', 64);
            $table->string('name');
            $table->string('unit_type', 64)->default('department');
            $table->unsignedBigInteger('parent_id')->nullable()->index();
            $table->unsignedBigInteger('department_id')->nullable()->index(); // bridge to legacy departments
            $table->string('status', 32)->default('active');
            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['tenant_id', 'code']);
        });

        Schema::create('organisational_unit_versions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('organisational_unit_id')->index();
            $table->unsignedInteger('version')->default(1);
            $table->json('snapshot');
            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->unique(['organisational_unit_id', 'version'], 'ou_versions_unique');
        });

        if (Schema::hasTable('positions')) {
            Schema::table('positions', function (Blueprint $table) {
                if (! Schema::hasColumn('positions', 'code')) {
                    $table->string('code', 64)->nullable()->after('title');
                }
                if (! Schema::hasColumn('positions', 'status')) {
                    $table->string('status', 32)->default('active')->after('is_active');
                }
                if (! Schema::hasColumn('positions', 'organisational_unit_id')) {
                    $table->unsignedBigInteger('organisational_unit_id')->nullable()->index()->after('department_id');
                }
                if (! Schema::hasColumn('positions', 'reports_to_position_id')) {
                    $table->unsignedBigInteger('reports_to_position_id')->nullable()->index();
                }
                if (! Schema::hasColumn('positions', 'effective_from')) {
                    $table->date('effective_from')->nullable();
                }
                if (! Schema::hasColumn('positions', 'effective_to')) {
                    $table->date('effective_to')->nullable();
                }
                if (! Schema::hasColumn('positions', 'is_sg_role')) {
                    $table->boolean('is_sg_role')->default(false);
                }
            });
        }

        Schema::create('position_versions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('position_id')->index();
            $table->unsignedInteger('version')->default(1);
            $table->json('snapshot');
            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->unique(['position_id', 'version']);
        });

        Schema::create('position_assignments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('position_id')->index();
            $table->unsignedBigInteger('person_id')->index();
            $table->string('assignment_type', 32)->default('substantive'); // substantive|acting|temporary
            $table->boolean('is_substantive')->default(true);
            $table->date('start_at');
            $table->date('end_at')->nullable();
            $table->unsignedBigInteger('appointment_document_id')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->string('status', 32)->default('active'); // pending|active|ended|cancelled
            $table->text('reason')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'person_id', 'status']);
            $table->index(['tenant_id', 'position_id', 'status']);
        });

        Schema::create('reporting_relationships', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('subordinate_position_id')->index();
            $table->unsignedBigInteger('supervisor_position_id')->index();
            $table->string('relationship_type', 32)->default('line'); // line|dotted|functional
            $table->boolean('is_primary')->default(true);
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->string('source', 64)->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->string('status', 32)->default('active');
            $table->timestamps();
        });

        Schema::create('job_descriptions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('position_id')->index();
            $table->string('title');
            $table->string('status', 32)->default('draft'); // draft|pending_ack|active|archived
            $table->unsignedInteger('current_version')->default(1);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('job_description_versions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('job_description_id')->index();
            $table->unsignedInteger('version');
            $table->text('content')->nullable();
            $table->json('duties')->nullable();
            $table->json('requirements')->nullable();
            $table->unsignedBigInteger('published_by')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->unsignedBigInteger('sg_acknowledged_by')->nullable();
            $table->timestamp('sg_acknowledged_at')->nullable();
            $table->unsignedBigInteger('employee_acknowledged_by')->nullable();
            $table->timestamp('employee_acknowledged_at')->nullable();
            $table->timestamps();
            $table->unique(['job_description_id', 'version'], 'jd_versions_unique');
        });

        Schema::create('user_role_assignments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('user_id')->index();
            $table->unsignedBigInteger('person_id')->nullable()->index();
            $table->string('role_name');
            $table->string('scope_type', 32)->nullable(); // tenant|unit|position
            $table->unsignedBigInteger('scope_id')->nullable();
            $table->boolean('is_privileged')->default(false);
            $table->string('status', 32)->default('pending'); // pending|active|revoked|rejected|expired
            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();
            $table->unsignedBigInteger('requested_by')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->unsignedBigInteger('revoked_by')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->text('reason')->nullable();
            $table->timestamps();
        });

        Schema::create('authority_definitions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('code', 64);
            $table->string('name');
            $table->string('module', 64)->nullable();
            $table->string('action', 64)->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_signing')->default(false);
            $table->boolean('is_contract_signing')->default(false);
            $table->boolean('allows_acting')->default(true);
            $table->boolean('allows_delegation')->default(true);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['tenant_id', 'code']);
        });

        Schema::create('authority_assignments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('authority_definition_id')->index();
            $table->string('assignee_type', 32); // Position|Person|ActingAppointment|Delegation
            $table->unsignedBigInteger('assignee_id');
            $table->json('scope')->nullable();
            $table->decimal('value_limit', 18, 2)->nullable();
            $table->string('currency', 8)->nullable();
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->unsignedBigInteger('source_policy_id')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->string('status', 32)->default('active');
            $table->timestamps();
            $table->index(['assignee_type', 'assignee_id']);
        });

        Schema::create('authority_snapshots', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('context_type'); // approval|signature
            $table->unsignedBigInteger('context_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('person_id')->nullable();
            $table->unsignedBigInteger('position_id')->nullable();
            $table->unsignedBigInteger('authority_assignment_id')->nullable();
            $table->unsignedBigInteger('delegation_id')->nullable();
            $table->unsignedBigInteger('acting_appointment_id')->nullable();
            $table->json('snapshot');
            $table->timestamp('captured_at');
            $table->timestamps();
        });

        Schema::create('acting_appointments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('reference')->nullable()->index();
            $table->unsignedBigInteger('position_id')->index();
            $table->unsignedBigInteger('person_id')->index();
            $table->unsignedBigInteger('substantive_person_id')->nullable()->index();
            $table->boolean('is_acting_sg')->default(false);
            $table->boolean('grants_allowance')->default(false); // never auto from short delegation
            $table->date('start_at');
            $table->date('end_at')->nullable();
            $table->string('status', 32)->default('pending'); // pending|approved|active|ended|cancelled
            $table->text('reason')->nullable();
            $table->unsignedBigInteger('requested_by')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
        });

        Schema::create('identity_delegations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('reference')->nullable()->index();
            $table->unsignedBigInteger('principal_person_id')->index();
            $table->unsignedBigInteger('delegate_person_id')->index();
            $table->unsignedBigInteger('principal_user_id')->nullable()->index();
            $table->unsignedBigInteger('delegate_user_id')->nullable()->index();
            $table->string('delegation_type', 48)->default('workflow'); // workflow|approval|signing|preparation|general
            $table->dateTime('start_at');
            $table->dateTime('end_at');
            $table->text('reason')->nullable();
            $table->string('authority_source', 64)->nullable();
            $table->boolean('allows_transitive')->default(false);
            $table->boolean('allows_contract_signing')->default(false);
            $table->boolean('creates_acting_allowance')->default(false);
            $table->string('status', 32)->default('pending'); // pending|approved|active|expired|revoked|rejected
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->unsignedBigInteger('revoked_by')->nullable();
            $table->text('revocation_reason')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('legacy_delegated_authority_id')->nullable(); // bridge to SAAM
            $table->timestamps();
        });

        Schema::create('identity_delegation_scopes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('identity_delegation_id')->index();
            $table->string('module', 64)->nullable();
            $table->string('action', 64); // draft|submit|approve|sign|prepare|upload
            $table->unsignedBigInteger('authority_definition_id')->nullable();
            $table->decimal('value_limit', 18, 2)->nullable();
            $table->string('currency', 8)->nullable();
            $table->json('constraints')->nullable();
            $table->timestamps();
        });

        Schema::create('signature_enrolments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('person_id')->index();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->unsignedBigInteger('signature_profile_id')->nullable()->index();
            $table->string('enrolment_type', 32)->default('drawn'); // drawn|uploaded|certificate_stub
            $table->string('status', 32)->default('pending'); // pending|active|suspended|revoked
            $table->string('specimen_path')->nullable(); // protected storage
            $table->string('specimen_hash', 128)->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('suspended_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->unsignedBigInteger('administered_by')->nullable();
            $table->timestamps();
        });

        Schema::create('document_signature_events', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('document_type');
            $table->unsignedBigInteger('document_id');
            $table->string('document_version_id')->nullable();
            $table->string('document_hash', 128);
            $table->unsignedBigInteger('signer_person_id')->index();
            $table->unsignedBigInteger('signer_account_id')->nullable()->index();
            $table->json('position_snapshot')->nullable();
            $table->json('department_snapshot')->nullable();
            $table->string('signature_meaning', 64); // approve|acknowledge|witness|certify|reject
            $table->unsignedBigInteger('authority_assignment_id')->nullable();
            $table->unsignedBigInteger('authority_snapshot_id')->nullable();
            $table->unsignedBigInteger('delegation_id')->nullable();
            $table->unsignedBigInteger('acting_appointment_id')->nullable();
            $table->unsignedBigInteger('signature_enrolment_id')->nullable();
            $table->string('authentication_strength', 32)->default('session');
            $table->string('signature_method', 32)->default('image');
            $table->string('verification_reference')->nullable();
            $table->string('status', 32)->default('valid'); // valid|superseded|revoked
            $table->boolean('is_immutable')->default(true);
            $table->timestamp('signed_at');
            $table->string('ip_address', 64)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamps();
            $table->index(['document_type', 'document_id']);
        });

        if (! Schema::hasTable('profile_change_requests')) {
            Schema::create('profile_change_requests', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('person_id')->nullable()->index();
                $table->unsignedBigInteger('user_id')->nullable()->index();
                $table->unsignedBigInteger('requested_by')->nullable();
                $table->string('field_group', 64)->nullable();
                $table->json('proposed_changes')->nullable();
                $table->json('requested_changes')->nullable();
                $table->string('status', 32)->default('pending');
                $table->unsignedBigInteger('reviewed_by')->nullable();
                $table->timestamp('reviewed_at')->nullable();
                $table->text('review_notes')->nullable();
                $table->timestamps();
            });
        } else {
            Schema::table('profile_change_requests', function (Blueprint $table) {
                if (! Schema::hasColumn('profile_change_requests', 'person_id')) {
                    $table->unsignedBigInteger('person_id')->nullable()->index()->after('tenant_id');
                }
                if (! Schema::hasColumn('profile_change_requests', 'field_group')) {
                    $table->string('field_group', 64)->nullable()->after('user_id');
                }
                if (! Schema::hasColumn('profile_change_requests', 'proposed_changes')) {
                    $table->json('proposed_changes')->nullable();
                }
                if (! Schema::hasColumn('profile_change_requests', 'requested_by')) {
                    $table->unsignedBigInteger('requested_by')->nullable();
                }
            });
        }

        Schema::create('access_review_campaigns', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('name');
            $table->string('status', 32)->default('draft'); // draft|open|closed
            $table->date('due_date')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('access_review_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('campaign_id')->index();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->unsignedBigInteger('person_id')->nullable()->index();
            $table->string('review_type', 64)->default('role'); // role|authority|delegation
            $table->json('subject_snapshot')->nullable();
            $table->string('decision', 32)->nullable(); // confirm|revoke|modify
            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('status', 32)->default('pending');
            $table->timestamps();
        });

        Schema::create('onboarding_cases', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('person_id')->nullable()->index();
            $table->string('reference')->nullable();
            $table->string('status', 32)->default('draft'); // draft|in_progress|completed|cancelled
            $table->json('checklist')->nullable();
            $table->unsignedBigInteger('target_position_id')->nullable();
            $table->unsignedBigInteger('target_unit_id')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('offboarding_cases', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('person_id')->index();
            $table->string('reference')->nullable();
            $table->string('status', 32)->default('draft');
            $table->json('checklist')->nullable();
            $table->boolean('access_actions_confirmed')->default(false);
            $table->date('last_working_day')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('transfer_cases', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('person_id')->index();
            $table->unsignedBigInteger('from_position_id')->nullable();
            $table->unsignedBigInteger('to_position_id')->nullable();
            $table->unsignedBigInteger('from_unit_id')->nullable();
            $table->unsignedBigInteger('to_unit_id')->nullable();
            $table->string('transfer_type', 32)->default('transfer'); // transfer|promotion
            $table->string('status', 32)->default('draft');
            $table->date('effective_date')->nullable();
            $table->text('reason')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
        });

        Schema::create('person_documents', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('person_id')->index();
            $table->string('file_class', 32)->default('open'); // open|confidential
            $table->string('document_type', 64);
            $table->string('title');
            $table->string('storage_path');
            $table->unsignedBigInteger('uploaded_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('identity_audit_events', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('event_type');
            $table->unsignedBigInteger('actor_user_id')->nullable();
            $table->unsignedBigInteger('person_id')->nullable();
            $table->string('subject_type')->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->json('payload')->nullable();
            $table->string('privacy_level', 32)->default('standard'); // standard|restricted
            $table->timestamps();
            $table->index(['tenant_id', 'event_type']);
        });

        Schema::create('people_authority_sod_rules', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->nullable()->index();
            $table->string('code', 64);
            $table->string('left_role_or_perm');
            $table->string('right_role_or_perm');
            $table->string('rule_type', 32)->default('incompatible');
            $table->boolean('is_active')->default(true);
            $table->text('description')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'code']);
        });
    }

    public function down(): void
    {
        $tables = [
            'profile_change_requests',
            'access_review_items',
            'access_review_campaigns',
            'transfer_cases',
            'offboarding_cases',
            'onboarding_cases',
            'person_documents',
            'identity_audit_events',
            'people_authority_sod_rules',
            'document_signature_events',
            'signature_enrolments',
            'identity_delegation_scopes',
            'identity_delegations',
            'acting_appointments',
            'authority_snapshots',
            'authority_assignments',
            'authority_definitions',
            'user_role_assignments',
            'job_description_versions',
            'job_descriptions',
            'reporting_relationships',
            'position_assignments',
            'position_versions',
            'organisational_unit_versions',
            'organisational_units',
            'employment_records',
            'person_user_links',
            'person_confidential_profiles',
            'people',
        ];
        foreach ($tables as $t) {
            // Do not drop legacy profile_change_requests owned by HR module.
            if ($t === 'profile_change_requests') {
                continue;
            }
            Schema::dropIfExists($t);
        }
    }
};
