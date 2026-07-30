<?php

namespace Tests\Feature\PeopleAuthority;

use App\Models\PeopleAuthority\DocumentSignatureEvent;
use App\Models\PeopleAuthority\EmploymentRecord;
use App\Models\PeopleAuthority\PeopleAiSuggestion;
use App\Models\PeopleAuthority\PeopleEsignRequest;
use App\Models\PeopleAuthority\Person;
use App\Models\PeopleAuthority\PersonUserLink;
use App\Models\PeopleAuthority\SignatureEnrolment;
use App\Models\PeopleAuthority\UserRoleAssignment;
use App\Models\Position;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\PeopleAuthority\Services\PeopleAiAssistService;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PeopleAuthorityPhase2Phase3Test extends TestCase
{
    private function seedPerson(User $user, array $overrides = []): Person
    {
        $person = Person::create(array_merge([
            'tenant_id' => $user->tenant_id,
            'first_name' => 'Ada',
            'last_name' => 'Lovelace',
            'display_name' => 'Ada Lovelace',
            'work_email' => 'ada+'.uniqid().'@example.org',
            'person_type' => 'employee',
            'employment_status' => 'active',
            'directory_visible' => true,
            'created_by' => $user->id,
        ], $overrides));

        PersonUserLink::create([
            'tenant_id' => $user->tenant_id,
            'person_id' => $person->id,
            'user_id' => $user->id,
            'link_type' => 'primary',
            'status' => 'active',
            'linked_at' => now(),
            'linked_by' => $user->id,
        ]);

        return $person;
    }

    public function test_phase2_schema_columns_exist(): void
    {
        $this->assertTrue(Schema::hasTable('people_esign_requests'));
        $this->assertTrue(Schema::hasTable('people_directory_sync_runs'));
        $this->assertTrue(Schema::hasTable('people_org_scenarios'));
        $this->assertTrue(Schema::hasTable('people_sod_conflict_reports'));
        $this->assertTrue(Schema::hasTable('people_succession_plans'));
        $this->assertTrue(Schema::hasTable('people_skills'));
        $this->assertTrue(Schema::hasTable('people_ai_suggestions'));
        $this->assertTrue(Schema::hasTable('people_privilege_alerts'));
        $this->assertTrue(Schema::hasColumn('signature_enrolments', 'certificate_thumbprint'));
        $this->assertTrue(Schema::hasColumn('document_signature_events', 'public_verification_token'));
        $this->assertTrue(Schema::hasColumn('employment_records', 'payroll_identifier'));
        $this->assertTrue(Schema::hasColumn('access_review_campaigns', 'campaign_type'));
    }

    public function test_certificate_enrolment_uses_stub_driver_by_default(): void
    {
        [, $hr] = $this->asHrManager();
        $person = $this->seedPerson($hr);

        $res = $this->asUser($hr)->postJson('/api/v1/people-authority/signatures/certificate-enrol', [
            'person_id' => $person->id,
            'subject' => 'CN=Ada Lovelace',
            'thumbprint' => 'abc123thumb',
        ]);
        $res->assertCreated()
            ->assertJsonPath('data.certificate_thumbprint', 'abc123thumb')
            ->assertJsonPath('data.enrolment_type', 'certificate_stub');

        $this->assertDatabaseHas('signature_enrolments', [
            'person_id' => $person->id,
            'certificate_thumbprint' => 'abc123thumb',
        ]);
    }

    public function test_esign_submit_requires_configured_provider_and_is_human_triggered(): void
    {
        [, $hr] = $this->asHrManager();

        $create = $this->asUser($hr)->postJson('/api/v1/people-authority/esign-requests', [
            'document_type' => 'policy',
            'document_id' => 42,
            'document_hash' => hash('sha256', 'doc'),
            'recipients' => [['email' => 'signer@example.org']],
        ]);
        $create->assertCreated();
        $id = $create->json('data.id');

        $this->asUser($hr)->postJson("/api/v1/people-authority/esign-requests/{$id}/submit")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['esign']);

        $this->assertSame('draft', PeopleEsignRequest::findOrFail($id)->status);
    }

    public function test_directory_sync_fixture_dry_run(): void
    {
        [, $hr] = $this->asHrManager();

        $fixture = tempnam(sys_get_temp_dir(), 'pa_m365_');
        file_put_contents($fixture, json_encode([
            'value' => [
                [
                    'id' => 'ext-1',
                    'displayName' => 'Grace Hopper',
                    'givenName' => 'Grace',
                    'surname' => 'Hopper',
                    'mail' => 'grace.hopper@example.org',
                    'jobTitle' => 'Rear Admiral',
                    'department' => 'Navy',
                ],
            ],
        ]));

        config([
            'people_authority.m365_driver' => 'fixture',
            'people_authority.m365_fixture_path' => $fixture,
            'people_authority.m365_dry_run_default' => true,
        ]);

        $res = $this->asUser($hr)->postJson('/api/v1/people-authority/directory-sync', [
            'driver' => 'fixture',
            'dry_run' => true,
        ]);
        $res->assertCreated()
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.dry_run', true)
            ->assertJsonPath('data.fetched_count', 1);

        $this->assertDatabaseMissing('people', [
            'tenant_id' => $hr->tenant_id,
            'work_email' => 'grace.hopper@example.org',
        ]);

        @unlink($fixture);
    }

    public function test_recertification_campaign_populates_role_items(): void
    {
        [, $hr] = $this->asHrManager();
        $staff = $this->makeUser('staff', Tenant::find($hr->tenant_id));

        UserRoleAssignment::create([
            'tenant_id' => $hr->tenant_id,
            'user_id' => $staff->id,
            'role_name' => 'staff',
            'status' => 'active',
            'is_privileged' => false,
            'effective_from' => now()->toDateString(),
            'requested_by' => $hr->id,
            'approved_by' => $hr->id,
            'approved_at' => now(),
        ]);

        $res = $this->asUser($hr)->postJson('/api/v1/people-authority/recertification-campaigns', [
            'auto_populate_roles' => true,
        ]);
        $res->assertCreated()
            ->assertJsonPath('data.campaign_type', 'recertification')
            ->assertJsonPath('data.status', 'open');

        $this->assertDatabaseHas('access_review_items', [
            'campaign_id' => $res->json('data.id'),
            'user_id' => $staff->id,
            'review_type' => 'role_recertification',
        ]);
    }

    public function test_sod_analysis_and_org_scenario(): void
    {
        [, $hr] = $this->asHrManager();

        $sod = $this->asUser($hr)->postJson('/api/v1/people-authority/sod-reports', [
            'title' => 'Test SoD',
        ]);
        $sod->assertCreated();
        $this->assertGreaterThanOrEqual(0, (int) $sod->json('data.conflict_count'));

        $scenario = $this->asUser($hr)->postJson('/api/v1/people-authority/org-scenarios', [
            'name' => 'FY27 restructure draft',
        ]);
        $scenario->assertCreated()
            ->assertJsonPath('data.status', 'draft');
        $this->assertIsArray($scenario->json('data.structure'));
    }

    public function test_payroll_link_export_and_public_signature_verify(): void
    {
        [, $hr] = $this->asHrManager();
        $person = $this->seedPerson($hr);

        $employment = EmploymentRecord::create([
            'tenant_id' => $hr->tenant_id,
            'person_id' => $person->id,
            'employee_number' => 'E-100',
            'status' => 'active',
        ]);

        $link = $this->asUser($hr)->postJson("/api/v1/people-authority/employment/{$employment->id}/payroll-link", [
            'payroll_identifier' => 'PAY-ADA-1',
        ]);
        $link->assertOk()->assertJsonPath('data.payroll_identifier', 'PAY-ADA-1');

        $export = $this->asUser($hr)->postJson('/api/v1/people-authority/employment/payroll-export');
        $export->assertOk()->assertJsonPath('data.count', 1);
        $this->assertStringContainsString('no rates', strtolower((string) $export->json('data.note')));

        $event = DocumentSignatureEvent::create([
            'tenant_id' => $hr->tenant_id,
            'document_type' => 'memo',
            'document_id' => 9,
            'document_hash' => hash('sha256', 'memo'),
            'signer_person_id' => $person->id,
            'signer_account_id' => $hr->id,
            'signature_meaning' => 'approve',
            'status' => 'valid',
            'is_immutable' => true,
            'signed_at' => now(),
        ]);

        $publish = $this->asUser($hr)->postJson("/api/v1/people-authority/documents/signatures/{$event->id}/publish-verification");
        $publish->assertOk();
        $token = $publish->json('data.public_verification_token');
        $this->assertNotEmpty($token);

        $verify = $this->getJson("/api/v1/people-authority/public/verify-signature/{$token}");
        $verify->assertOk()->assertJsonPath('data.valid', true)->assertJsonPath('data.document_hash', $event->document_hash);
        $payload = $verify->json('data');
        $this->assertArrayNotHasKey('ip_address', $payload);
        $this->assertArrayNotHasKey('user_agent', $payload);
    }

    public function test_phase3_succession_skills_analytics_search(): void
    {
        [, $hr] = $this->asHrManager();
        $person = $this->seedPerson($hr);
        $dept = $this->makeDepartment(Tenant::find($hr->tenant_id));
        $position = Position::create([
            'tenant_id' => $hr->tenant_id,
            'department_id' => $dept->id,
            'title' => 'Director '.uniqid(),
            'code' => 'P'.substr(uniqid(), -5),
            'is_active' => true,
            'status' => 'active',
            'headcount' => 1,
        ]);

        $plan = $this->asUser($hr)->postJson('/api/v1/people-authority/succession-plans', [
            'position_id' => $position->id,
            'title' => 'Director succession',
            'candidates' => [
                ['person_id' => $person->id, 'readiness' => 'developing', 'rank' => 1],
            ],
        ]);
        $plan->assertCreated();
        $this->assertCount(1, $plan->json('data.candidates'));

        $skill = $this->asUser($hr)->postJson('/api/v1/people-authority/skills', [
            'code' => 'gov-'.uniqid(),
            'name' => 'Governance',
            'category' => 'core',
        ]);
        $skill->assertCreated();

        $this->asUser($hr)->postJson('/api/v1/people-authority/person-skills', [
            'person_id' => $person->id,
            'skill_id' => $skill->json('data.id'),
            'level' => 'proficient',
        ])->assertCreated();

        $this->asUser($hr)->getJson('/api/v1/people-authority/analytics')
            ->assertOk()
            ->assertJsonStructure(['data' => ['people_active', 'succession_plans', 'skills_catalog']]);

        $this->asUser($hr)->getJson('/api/v1/people-authority/search?q='.urlencode($person->first_name))
            ->assertOk()
            ->assertJsonPath('data.query', $person->first_name);
    }

    public function test_ai_never_auto_grants_and_requires_human_confirm(): void
    {
        $ai = app(PeopleAiAssistService::class);
        $this->assertFalse($ai->canAutoGrantAccess());
        $this->assertFalse($ai->canAutoGrantAuthority());
        $this->assertFalse($ai->canAutoCreateDelegation());
        $this->assertFalse($ai->canAutoGrantSigningRights());
        $this->assertFalse($ai->canAutoAssignPrivilegedRole());

        [, $hr] = $this->asHrManager();

        $suggest = $this->asUser($hr)->postJson('/api/v1/people-authority/ai/suggestions', [
            'kind' => 'access_recommendation',
            'context' => ['person_id' => 1],
        ]);
        $suggest->assertCreated()
            ->assertJsonPath('data.status', 'pending_confirmation')
            ->assertJsonPath('data.auto_applied', false);
        $id = $suggest->json('data.id');

        $this->asUser($hr)->postJson("/api/v1/people-authority/ai/suggestions/{$id}/apply", [
            'action' => 'grant_access',
            'confirmed' => true,
        ])->assertUnprocessable()->assertJsonValidationErrors(['action']);

        $this->asUser($hr)->postJson("/api/v1/people-authority/ai/suggestions/{$id}/apply", [
            'action' => 'attach_note',
        ])->assertUnprocessable()->assertJsonValidationErrors(['confirmed']);

        $this->asUser($hr)->postJson("/api/v1/people-authority/ai/suggestions/{$id}/apply", [
            'action' => 'attach_note',
            'confirmed' => true,
            'note' => 'Reviewed by HR',
        ])->assertOk()->assertJsonPath('data.status', 'applied');

        $row = PeopleAiSuggestion::findOrFail($id);
        $this->assertFalse($row->auto_applied);
    }

    public function test_privilege_alert_detection_endpoint(): void
    {
        [, $hr] = $this->asHrManager();

        $detect = $this->asUser($hr)->postJson('/api/v1/people-authority/privilege-alerts/detect');
        $detect->assertCreated();
        $this->assertArrayHasKey('alerts', $detect->json('data'));
    }
}
