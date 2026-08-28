<?php

namespace Tests\Feature\Lifecycle;

use App\Models\HrContractType;
use App\Models\HrGradeBand;
use App\Models\HrPersonalFile;
use App\Models\Lifecycle\LifecycleCase;
use App\Models\Lifecycle\LifecycleJourneyTemplate;
use App\Models\Lifecycle\LifecycleJourneyTemplateVersion;
use App\Models\Lifecycle\LifecycleTaskInstance;
use App\Models\Tenant;
use App\Models\User;
use Carbon\Carbon;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class LifecycleFeatureTest extends TestCase
{
    protected function seedLifecycleTemplates(Tenant $tenant, ?User $publisher = null): void
    {
        $publisher ??= User::factory()->create(['tenant_id' => $tenant->id]);
        $publisherId = $publisher->id;

        $definitions = [
            ['code' => 'onboarding-local', 'name' => 'Local staff onboarding', 'lifecycle_type' => 'onboarding', 'category' => 'local'],
            ['code' => 'onboarding-regional', 'name' => 'Regional staff onboarding', 'lifecycle_type' => 'onboarding', 'category' => 'regional'],
            ['code' => 'separation-resignation', 'name' => 'Resignation separation', 'lifecycle_type' => 'separation', 'category' => 'resignation'],
            ['code' => 'separation-end-of-contract', 'name' => 'End of contract separation', 'lifecycle_type' => 'separation', 'category' => 'end_of_contract'],
            ['code' => 'transfer-internal', 'name' => 'Internal transfer', 'lifecycle_type' => 'transfer', 'category' => 'internal'],
            ['code' => 'promotion', 'name' => 'Promotion', 'lifecycle_type' => 'promotion', 'category' => 'standard'],
            ['code' => 'probation-review', 'name' => 'Probation review', 'lifecycle_type' => 'probation', 'category' => 'standard'],
        ];

        foreach ($definitions as $def) {
            $template = LifecycleJourneyTemplate::firstOrCreate(
                ['tenant_id' => $tenant->id, 'code' => $def['code']],
                [
                    'name' => $def['name'],
                    'lifecycle_type' => $def['lifecycle_type'],
                    'status' => 'active',
                    'created_by' => $publisherId,
                ]
            );

            if (LifecycleJourneyTemplateVersion::where('template_id', $template->id)->where('status', 'published')->exists()) {
                continue;
            }

            $definition = match ($def['lifecycle_type']) {
                'onboarding' => \Database\Seeders\LifecycleJourneyTemplateSeeder::buildOnboardingDefinition($def['category']),
                'separation' => \Database\Seeders\LifecycleJourneyTemplateSeeder::buildSeparationDefinition($def['category']),
                default => \Database\Seeders\LifecycleJourneyTemplateSeeder::buildInternalDefinition($def['lifecycle_type'], $def['category']),
            };

            LifecycleJourneyTemplateVersion::create([
                'tenant_id' => $tenant->id,
                'template_id' => $template->id,
                'version_number' => 1,
                'status' => 'published',
                'definition' => $definition,
                'published_at' => now(),
                'published_by' => $publisherId,
                'created_by' => $publisherId,
            ]);
        }
    }

    protected function grantLifecycle(User $user, array $permissions): void
    {
        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'sanctum']);
            $user->givePermissionTo($perm);
        }
    }

    protected function personalFile(Tenant $tenant, User $employee, array $extra = []): HrPersonalFile
    {
        return HrPersonalFile::create(array_merge([
            'tenant_id' => $tenant->id,
            'employee_id' => $employee->id,
            'created_by' => $employee->id,
            'file_status' => 'active',
            'employment_status' => 'active',
        ], $extra));
    }

    protected function publishedOnboardingVersion(Tenant $tenant): LifecycleJourneyTemplateVersion
    {
        $template = LifecycleJourneyTemplate::where('tenant_id', $tenant->id)
            ->where('code', 'onboarding-local')
            ->firstOrFail();

        return LifecycleJourneyTemplateVersion::where('template_id', $template->id)
            ->where('status', 'published')
            ->firstOrFail();
    }

    // ONB-001: HR can initiate onboarding case
    public function test_onb_001_hr_initiates_onboarding_case(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seedLifecycleTemplates($tenant);
        [$http, $hr] = $this->asHrManager($tenant);
        $this->grantLifecycle($hr, ['lifecycle.manage-onboarding', 'lifecycle.view']);

        $employee = User::factory()->create(['tenant_id' => $tenant->id]);

        $response = $http->postJson('/api/v1/lifecycle/onboarding', [
            'employee_id' => $employee->id,
            'template_code' => 'onboarding-local',
            'employment_category' => 'local',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.lifecycle_type', 'onboarding')
            ->assertJsonPath('data.employee.id', $employee->id);

        $this->assertDatabaseHas('lifecycle_cases', [
            'employee_id' => $employee->id,
            'lifecycle_type' => 'onboarding',
        ]);
    }

    // ONB-003: Case uses published template version
    public function test_onb_003_uses_published_template_version(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seedLifecycleTemplates($tenant);
        [$http, $hr] = $this->asHrManager($tenant);
        $this->grantLifecycle($hr, ['lifecycle.manage-onboarding', 'lifecycle.view']);

        $employee = User::factory()->create(['tenant_id' => $tenant->id]);
        $version = $this->publishedOnboardingVersion($tenant);

        $http->postJson('/api/v1/lifecycle/onboarding', [
            'employee_id' => $employee->id,
            'template_code' => 'onboarding-local',
        ])->assertCreated()
            ->assertJsonPath('data.template.version_number', $version->version_number);

        $case = LifecycleCase::where('employee_id', $employee->id)->first();
        $this->assertSame($version->id, $case->template_version_id);
    }

    // ONB-004 / parallel stages spawn Finance/ICT/Admin assignments
    public function test_onb_004_spawns_parallel_department_assignments(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seedLifecycleTemplates($tenant);
        [$http, $hr] = $this->asHrManager($tenant);
        $this->grantLifecycle($hr, ['lifecycle.manage-onboarding', 'lifecycle.view']);

        $employee = User::factory()->create(['tenant_id' => $tenant->id]);

        $http->postJson('/api/v1/lifecycle/onboarding', [
            'employee_id' => $employee->id,
            'template_code' => 'onboarding-local',
        ])->assertCreated();

        $case = LifecycleCase::where('employee_id', $employee->id)->first();
        $taskKeys = $case->tasks()->pluck('task_key')->all();

        $this->assertContains('payroll_setup', $taskKeys);
        $this->assertContains('ict_account', $taskKeys);
        $this->assertContains('access_badge', $taskKeys);

        $assignmentCount = $case->tasks()->whereNotNull('assignment_id')->count();
        $this->assertGreaterThanOrEqual(3, $assignmentCount);
    }

    // LIFE-RULE-001: Regional-only stage excluded for local category
    public function test_life_rule_001_regional_stage_excluded_for_local(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seedLifecycleTemplates($tenant);
        [$http, $hr] = $this->asHrManager($tenant);
        $this->grantLifecycle($hr, ['lifecycle.manage-onboarding', 'lifecycle.view']);

        $employee = User::factory()->create(['tenant_id' => $tenant->id]);

        $http->postJson('/api/v1/lifecycle/onboarding', [
            'employee_id' => $employee->id,
            'template_code' => 'onboarding-local',
            'employee_category' => 'local',
        ])->assertCreated();

        $case = LifecycleCase::where('employee_id', $employee->id)->first();
        $this->assertFalse($case->tasks()->where('task_key', 'regional_orientation')->exists());
    }

    // LIFE-RULE-002: Regional stage included for regional category
    public function test_life_rule_002_regional_stage_included_for_regional(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seedLifecycleTemplates($tenant);
        [$http, $hr] = $this->asHrManager($tenant);
        $this->grantLifecycle($hr, ['lifecycle.manage-onboarding', 'lifecycle.view']);

        $employee = User::factory()->create(['tenant_id' => $tenant->id]);

        $http->postJson('/api/v1/lifecycle/onboarding', [
            'employee_id' => $employee->id,
            'template_code' => 'onboarding-regional',
            'employee_category' => 'regional',
        ])->assertCreated();

        $case = LifecycleCase::where('employee_id', $employee->id)->first();
        $this->assertTrue($case->tasks()->where('task_key', 'regional_orientation')->exists());
    }

    // LIFE-RULE-003: Due dates computed from anchor + offset
    public function test_life_rule_003_relative_due_dates_from_case_start(): void
    {
        Carbon::setTestNow('2026-08-01');
        $tenant = Tenant::factory()->create();
        $this->seedLifecycleTemplates($tenant);
        [$http, $hr] = $this->asHrManager($tenant);
        $this->grantLifecycle($hr, ['lifecycle.manage-onboarding', 'lifecycle.view']);

        $employee = User::factory()->create(['tenant_id' => $tenant->id]);

        $http->postJson('/api/v1/lifecycle/onboarding', [
            'employee_id' => $employee->id,
            'template_code' => 'onboarding-local',
            'start_date' => '2026-08-01',
        ])->assertCreated();

        $payrollTask = LifecycleTaskInstance::where('task_key', 'payroll_setup')->first();
        $this->assertSame('2026-08-04', $payrollTask->due_date->toDateString());
        Carbon::setTestNow();
    }

    // ONB-005: Employee cannot complete departmental tasks
    public function test_onb_005_employee_cannot_complete_department_task(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seedLifecycleTemplates($tenant);
        [$httpHr, $hr] = $this->asHrManager($tenant);
        $this->grantLifecycle($hr, ['lifecycle.manage-onboarding', 'lifecycle.view']);

        $employee = User::factory()->create(['tenant_id' => $tenant->id]);
        $employee->givePermissionTo(['lifecycle.view-own', 'lifecycle.complete-own-tasks']);

        $httpHr->postJson('/api/v1/lifecycle/onboarding', [
            'employee_id' => $employee->id,
            'template_code' => 'onboarding-local',
        ])->assertCreated();

        $deptTask = LifecycleTaskInstance::where('task_key', 'payroll_setup')->first();

        $this->asUser($employee);
        $this->postJson("/api/v1/lifecycle/tasks/{$deptTask->id}/complete", [
            'revision' => $deptTask->revision,
        ])->assertForbidden();
    }

    // ONB-006/007: Readiness tracks mandatory completion
    public function test_onb_006_readiness_requires_mandatory_tasks(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seedLifecycleTemplates($tenant);
        [$http, $hr] = $this->asHrManager($tenant);
        $this->grantLifecycle($hr, [
            'lifecycle.manage-onboarding', 'lifecycle.view',
            'lifecycle.complete-department-tasks', 'lifecycle.complete-own-tasks',
        ]);

        $employee = User::factory()->create(['tenant_id' => $tenant->id]);
        $employee->givePermissionTo(['lifecycle.view-own', 'lifecycle.complete-own-tasks']);

        $http->postJson('/api/v1/lifecycle/onboarding', [
            'employee_id' => $employee->id,
            'template_code' => 'onboarding-local',
        ])->assertCreated();

        $case = LifecycleCase::where('employee_id', $employee->id)->first();
        $this->assertFalse($case->readiness['ready']);

        foreach ($case->tasks as $task) {
            $actor = $task->assignee_role === 'employee' ? $employee : $hr;
            $this->asUser($actor);
            $this->postJson("/api/v1/lifecycle/tasks/{$task->id}/complete", [
                'revision' => $task->revision,
            ])->assertOk();
            $task->refresh();
        }

        $case->refresh();
        $this->assertTrue($case->readiness['ready']);
    }

    // SEP-001: HR initiates separation with notice snapshot
    public function test_sep_001_initiates_separation_with_notice_snapshot(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seedLifecycleTemplates($tenant);
        [$http, $hr] = $this->asHrManager($tenant);
        $this->grantLifecycle($hr, ['lifecycle.manage-separation', 'lifecycle.view']);

        $employee = User::factory()->create(['tenant_id' => $tenant->id]);
        HrGradeBand::create([
            'tenant_id' => $tenant->id,
            'code' => 'P3',
            'label' => 'P3',
            'band_group' => 'C',
            'notice_period_days' => 30,
            'probation_months' => 6,
            'status' => 'published',
            'effective_from' => now()->subYear(),
        ]);
        $this->personalFile($tenant, $employee, ['grade_scale' => 'P3']);

        $response = $http->postJson('/api/v1/lifecycle/separation', [
            'employee_id' => $employee->id,
            'separation_reason' => 'resignation',
            'last_working_day' => '2026-09-30',
            'initiated_at' => '2026-08-01',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.lifecycle_type', 'separation')
            ->assertJsonPath('data.notice_snapshot.notice_period_days', 30)
            ->assertJsonPath('data.terminal_payment_blocked', true);
    }

    // SEP-CLEAR-004: Terminal payment blocked until clearance
    public function test_sep_clear_004_terminal_payment_blocked_until_cleared(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seedLifecycleTemplates($tenant);
        [$http, $hr] = $this->asHrManager($tenant);
        $this->grantLifecycle($hr, [
            'lifecycle.manage-separation', 'lifecycle.view',
            'lifecycle.complete-department-tasks', 'lifecycle.approve-exceptions',
            'lifecycle.finalise-separation',
        ]);

        $employee = User::factory()->create(['tenant_id' => $tenant->id]);
        HrContractType::create([
            'tenant_id' => $tenant->id,
            'code' => 'permanent',
            'name' => 'Permanent',
            'notice_period_days' => 30,
            'has_probation' => false,
            'is_permanent' => true,
            'is_active' => true,
            'is_renewable' => false,
        ]);
        $this->personalFile($tenant, $employee, ['contract_type' => 'permanent']);

        $http->postJson('/api/v1/lifecycle/separation', [
            'employee_id' => $employee->id,
            'separation_reason' => 'resignation',
            'last_working_day' => '2026-09-30',
        ])->assertCreated();

        $case = LifecycleCase::where('employee_id', $employee->id)->first();

        $http->getJson("/api/v1/lifecycle/cases/{$case->id}/terminal-payment")
            ->assertStatus(422)
            ->assertJsonPath('allowed', false);

        foreach ($case->tasks()->where('assignee_role', '!=', 'employee')->get() as $task) {
            $http->postJson("/api/v1/lifecycle/tasks/{$task->id}/clearance", [
                'clearance_status' => 'cleared',
                'revision' => $task->revision,
            ])->assertOk();
            $task->refresh();
        }

        $case->refresh();
        $this->assertFalse($case->terminal_payment_blocked);

        $http->getJson("/api/v1/lifecycle/cases/{$case->id}/terminal-payment")
            ->assertOk()
            ->assertJsonPath('allowed', true);
    }

    // HIST-003: Published template versions are immutable
    public function test_hist_003_published_template_immutable(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seedLifecycleTemplates($tenant);
        [$http, $hr] = $this->asHrManager($tenant);
        $this->grantLifecycle($hr, ['lifecycle.templates.view', 'lifecycle.templates.publish']);

        $version = $this->publishedOnboardingVersion($tenant);

        $http->postJson("/api/v1/lifecycle/templates/{$version->id}/publish")
            ->assertStatus(422);
    }

    // RBAC-LIFE-001: ICT user does not see confidential fields
    public function test_rbac_life_001_ict_cannot_see_confidential_fields(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seedLifecycleTemplates($tenant);
        [$httpHr, $hr] = $this->asHrManager($tenant);
        $this->grantLifecycle($hr, ['lifecycle.manage-onboarding', 'lifecycle.view', 'lifecycle.view-confidential']);

        $employee = User::factory()->create(['tenant_id' => $tenant->id]);
        $ict = User::factory()->create(['tenant_id' => $tenant->id]);
        $this->grantLifecycle($ict, ['lifecycle.view', 'lifecycle.complete-department-tasks']);

        $response = $httpHr->postJson('/api/v1/lifecycle/onboarding', [
            'employee_id' => $employee->id,
            'template_code' => 'onboarding-local',
        ]);
        $caseId = $response->json('data.id');

        $this->asUser($ict);
        $payload = $this->getJson("/api/v1/lifecycle/cases/{$caseId}")->json('data');
        $this->assertArrayNotHasKey('salary_details', $payload['confidential'] ?? []);
    }

    // Audit: initiate records timeline event
    public function test_audit_records_initiate_event(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seedLifecycleTemplates($tenant);
        [$http, $hr] = $this->asHrManager($tenant);
        $this->grantLifecycle($hr, ['lifecycle.manage-onboarding', 'lifecycle.view']);

        $employee = User::factory()->create(['tenant_id' => $tenant->id]);

        $http->postJson('/api/v1/lifecycle/onboarding', [
            'employee_id' => $employee->id,
            'template_code' => 'onboarding-local',
        ])->assertCreated();

        $case = LifecycleCase::where('employee_id', $employee->id)->first();
        $this->assertDatabaseHas('lifecycle_events', [
            'case_id' => $case->id,
            'event_type' => 'case.initiated',
        ]);
    }

    // 409 concurrency on stale revision
    public function test_409_on_stale_task_revision(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seedLifecycleTemplates($tenant);
        [$http, $hr] = $this->asHrManager($tenant);
        $this->grantLifecycle($hr, [
            'lifecycle.manage-onboarding', 'lifecycle.view', 'lifecycle.complete-department-tasks',
        ]);

        $employee = User::factory()->create(['tenant_id' => $tenant->id]);
        $http->postJson('/api/v1/lifecycle/onboarding', [
            'employee_id' => $employee->id,
            'template_code' => 'onboarding-local',
        ]);

        $task = LifecycleTaskInstance::where('task_key', 'payroll_setup')->first();

        $http->postJson("/api/v1/lifecycle/tasks/{$task->id}/complete", [
            'revision' => 999,
        ])->assertStatus(409);
    }

    // Exception flow: not_cleared requires authoriser
    public function test_sep_clear_exception_requires_authoriser(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seedLifecycleTemplates($tenant);
        [$http, $hr] = $this->asHrManager($tenant);
        $this->grantLifecycle($hr, [
            'lifecycle.manage-separation', 'lifecycle.view',
            'lifecycle.complete-department-tasks', 'lifecycle.approve-exceptions',
        ]);

        $employee = User::factory()->create(['tenant_id' => $tenant->id]);
        HrContractType::create([
            'tenant_id' => $tenant->id,
            'code' => 'permanent',
            'name' => 'Permanent',
            'notice_period_days' => 30,
            'has_probation' => false,
            'is_permanent' => true,
            'is_active' => true,
            'is_renewable' => false,
        ]);
        $this->personalFile($tenant, $employee, ['contract_type' => 'permanent']);

        $http->postJson('/api/v1/lifecycle/separation', [
            'employee_id' => $employee->id,
            'last_working_day' => '2026-09-30',
        ]);

        $task = LifecycleTaskInstance::where('task_key', 'finance_clearance')->first();

        $http->postJson("/api/v1/lifecycle/tasks/{$task->id}/clearance", [
            'clearance_status' => 'not_cleared',
            'revision' => $task->revision,
        ])->assertOk();

        $http->postJson("/api/v1/lifecycle/tasks/{$task->id}/clearance", [
            'clearance_status' => 'cleared',
            'revision' => $task->revision + 1,
        ])->assertStatus(422);

        $exceptionResponse = $http->postJson("/api/v1/lifecycle/tasks/{$task->id}/exceptions", [
            'reason' => 'Outstanding imprest waived by HR Director',
        ]);
        $exceptionResponse->assertCreated();

        $exceptionId = $exceptionResponse->json('data.id');
        $http->postJson("/api/v1/lifecycle/exceptions/{$exceptionId}/approve", [
            'resolution_notes' => 'Authorised waiver recorded',
        ])->assertOk();

        $task->refresh();
        $this->assertSame('exception_approved', $task->clearance_status);
    }

    public function test_phase2_analytics_reports_cycle_time_and_bottlenecks(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seedLifecycleTemplates($tenant);
        [$http, $hr] = $this->asHrManager($tenant);
        $this->grantLifecycle($hr, ['lifecycle.manage-onboarding', 'lifecycle.view']);

        $employee = User::factory()->create(['tenant_id' => $tenant->id]);
        $http->postJson('/api/v1/lifecycle/onboarding', [
            'employee_id' => $employee->id,
            'template_code' => 'onboarding-local',
        ])->assertCreated();

        $case = LifecycleCase::where('employee_id', $employee->id)->firstOrFail();
        $case->forceFill([
            'start_date' => now()->subDays(10)->toDateString(),
            'status' => 'completed',
            'completed_at' => now()->subDays(2),
        ])->save();

        $openEmployee = User::factory()->create(['tenant_id' => $tenant->id]);
        $http->postJson('/api/v1/lifecycle/onboarding', [
            'employee_id' => $openEmployee->id,
            'template_code' => 'onboarding-local',
        ])->assertCreated();

        $openTask = LifecycleTaskInstance::where('task_key', 'payroll_setup')
            ->whereHas('lifecycleCase', fn ($q) => $q->where('employee_id', $openEmployee->id))
            ->firstOrFail();
        $openTask->forceFill(['due_date' => now()->subDays(9)->toDateString()])->save();

        $response = $http->getJson('/api/v1/lifecycle/analytics');
        $response->assertOk()
            ->assertJsonPath('data.by_type.onboarding.completed', 1)
            ->assertJsonPath('data.by_type.onboarding.open', 1);

        $this->assertEqualsWithDelta(8.0, (float) $response->json('data.by_type.onboarding.avg_cycle_days'), 1.0);
        $this->assertNotEmpty($response->json('data.bottlenecks'));
        $this->assertSame('payroll_setup', $response->json('data.bottlenecks.0.task_key'));
        $this->assertArrayHasKey('0_7', $response->json('data.clearance_aging'));
        $this->assertIsInt($response->json('data.exceptions_open'));
    }

    public function test_phase2_hr_initiates_transfer_journey(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seedLifecycleTemplates($tenant);
        [$http, $hr] = $this->asHrManager($tenant);
        $this->grantLifecycle($hr, ['lifecycle.manage-onboarding', 'lifecycle.view']);

        $employee = User::factory()->create(['tenant_id' => $tenant->id]);

        $http->postJson('/api/v1/lifecycle/journeys', [
            'lifecycle_type' => 'transfer',
            'employee_id' => $employee->id,
            'template_code' => 'transfer-internal',
        ])->assertCreated()
            ->assertJsonPath('data.lifecycle_type', 'transfer');

        $this->assertDatabaseHas('lifecycle_cases', [
            'employee_id' => $employee->id,
            'lifecycle_type' => 'transfer',
        ]);
        $this->assertStringStartsWith('TRF-', LifecycleCase::where('employee_id', $employee->id)->value('reference'));
    }

    public function test_phase2_hr_initiates_promotion_and_probation_journeys(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seedLifecycleTemplates($tenant);
        [$http, $hr] = $this->asHrManager($tenant);
        $this->grantLifecycle($hr, ['lifecycle.manage-onboarding', 'lifecycle.view']);

        $promotionEmployee = User::factory()->create(['tenant_id' => $tenant->id]);
        $probationEmployee = User::factory()->create(['tenant_id' => $tenant->id]);

        $http->postJson('/api/v1/lifecycle/journeys', [
            'lifecycle_type' => 'promotion',
            'employee_id' => $promotionEmployee->id,
        ])->assertCreated()->assertJsonPath('data.lifecycle_type', 'promotion');

        $http->postJson('/api/v1/lifecycle/journeys', [
            'lifecycle_type' => 'probation',
            'employee_id' => $probationEmployee->id,
        ])->assertCreated()->assertJsonPath('data.lifecycle_type', 'probation');
    }

    public function test_phase2_transfer_completes_when_mandatory_tasks_done(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seedLifecycleTemplates($tenant);
        [$http, $hr] = $this->asHrManager($tenant);
        $this->grantLifecycle($hr, [
            'lifecycle.manage-onboarding',
            'lifecycle.view',
            'lifecycle.complete-department-tasks',
        ]);

        $employee = User::factory()->create(['tenant_id' => $tenant->id]);
        $http->postJson('/api/v1/lifecycle/journeys', [
            'lifecycle_type' => 'transfer',
            'employee_id' => $employee->id,
        ])->assertCreated();

        $case = LifecycleCase::where('employee_id', $employee->id)->firstOrFail();
        foreach ($case->tasks as $task) {
            $http->postJson("/api/v1/lifecycle/tasks/{$task->id}/complete", [
                'revision' => $task->revision,
            ])->assertOk();
            $task->refresh();
        }

        $case->refresh();
        $this->assertSame('completed', $case->status);
        $this->assertNotNull($case->completed_at);
    }

    public function test_phase2_staff_cannot_read_analytics(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $http->getJson('/api/v1/lifecycle/analytics')->assertForbidden();
    }
}
