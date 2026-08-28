<?php

namespace Tests\Unit\Lifecycle;

use App\Models\HrContractType;
use App\Models\HrGradeBand;
use App\Models\HrPersonalFile;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Lifecycle\Services\NoticeRuleService;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class NoticeRuleServiceTest extends TestCase
{
    private NoticeRuleService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(NoticeRuleService::class);
    }

    public function test_resolves_notice_from_published_grade_band(): void
    {
        $tenant = Tenant::factory()->create();
        $employee = User::factory()->create(['tenant_id' => $tenant->id]);

        $band = HrGradeBand::create([
            'tenant_id' => $tenant->id,
            'code' => 'P4',
            'label' => 'Professional P4',
            'band_group' => 'C',
            'employment_category' => 'local',
            'notice_period_days' => 30,
            'probation_months' => 6,
            'status' => 'published',
            'effective_from' => now()->subYear(),
        ]);

        HrPersonalFile::create([
            'tenant_id' => $tenant->id,
            'employee_id' => $employee->id,
            'created_by' => $employee->id,
            'grade_scale' => 'P4',
            'file_status' => 'active',
            'employment_status' => 'active',
        ]);

        $resolved = $this->service->resolve($employee);

        $this->assertSame(30, $resolved['notice_period_days']);
        $this->assertSame(6, $resolved['probation_months']);
        $this->assertSame('grade_band', $resolved['source']);
        $this->assertSame($band->id, $resolved['grade_band_id']);
    }

    public function test_resolves_notice_from_contract_type_when_no_grade_band(): void
    {
        $tenant = Tenant::factory()->create();
        $employee = User::factory()->create(['tenant_id' => $tenant->id]);

        $contract = HrContractType::create([
            'tenant_id' => $tenant->id,
            'code' => 'fixed_term',
            'name' => 'Fixed term',
            'is_permanent' => false,
            'has_probation' => true,
            'probation_months' => 3,
            'notice_period_days' => 14,
            'is_renewable' => true,
            'is_active' => true,
        ]);

        HrPersonalFile::create([
            'tenant_id' => $tenant->id,
            'employee_id' => $employee->id,
            'created_by' => $employee->id,
            'contract_type' => 'fixed_term',
            'file_status' => 'active',
            'employment_status' => 'active',
        ]);

        $resolved = $this->service->resolve($employee);

        $this->assertSame(14, $resolved['notice_period_days']);
        $this->assertSame(3, $resolved['probation_months']);
        $this->assertSame('contract_type', $resolved['source']);
        $this->assertSame($contract->id, $resolved['contract_type_id']);
    }

    public function test_fails_when_no_published_policy_exists(): void
    {
        $tenant = Tenant::factory()->create();
        $employee = User::factory()->create(['tenant_id' => $tenant->id]);

        $this->expectException(ValidationException::class);
        $this->service->resolve($employee);
    }

    public function test_notice_end_date_uses_snapshot_days(): void
    {
        $snapshot = ['notice_period_days' => 21];
        $end = $this->service->noticeEndDate(new \DateTimeImmutable('2026-08-01'), $snapshot);

        $this->assertSame('2026-08-22', $end->toDateString());
    }
}
