<?php

namespace Tests\Feature\Budget;

use App\Models\Budget;
use App\Models\BudgetCycle;
use App\Models\BudgetCycleDecision;
use App\Models\BudgetLine;
use App\Models\BudgetSubmission;
use App\Models\FinancialYear;
use App\Models\FundingSource;
use App\Models\Tenant;
use App\Modules\Budget\Services\BudgetAvailabilityService;
use App\Modules\Budget\Services\BudgetCycleService;
use App\Modules\Budget\Services\BudgetInstitutionalDecisionService;
use App\Modules\Budget\Services\BudgetSubmissionService;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class BudgetAnnualCycleTest extends TestCase
{
    private function openCycle(Tenant $tenant, int $startYear = 2027): array
    {
        $finance = $this->makeFinanceController($tenant);
        $fy = FinancialYear::defaultAprilMarch($tenant->id, $startYear);
        $cycle = app(BudgetCycleService::class)->open($tenant->id, $fy->id, $finance);

        return compact('finance', 'fy', 'cycle');
    }

    private function recordInstitutionalApprovals(BudgetCycle $cycle, $actor): BudgetCycle
    {
        $decisions = app(BudgetInstitutionalDecisionService::class);
        foreach ([
            BudgetCycleDecision::BODY_FSC,
            BudgetCycleDecision::BODY_EXCO,
            BudgetCycleDecision::BODY_PLENARY,
        ] as $body) {
            $decisions->record($cycle->fresh(), [
                'body' => $body,
                'decision' => BudgetCycleDecision::DECISION_APPROVED,
                'meeting_on' => '2026-11-15',
                'minute_reference' => strtoupper($body).'-MIN-1',
                'comments' => 'Approved',
            ], $actor);
        }

        return $cycle->fresh();
    }

    public function test_open_cycle_publish_guidelines_and_submit_pack(): void
    {
        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'cycle' => $cycle] = $this->openCycle($tenant);
        $dept = $this->makeDepartment($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $staff->update(['department_id' => $dept->id]);

        $svc = app(BudgetCycleService::class);
        $guideline = $svc->publishGuidelines($cycle, [
            'assumptions' => 'Inflation 5%',
            'inflation_rate' => 5,
            'department_deadline' => '2026-10-31',
        ], $finance);

        $this->assertNotNull($guideline->published_at);
        $this->assertSame(BudgetCycle::STATUS_DEPARTMENT_PREPARATION, $cycle->fresh()->status);

        $source = FundingSource::create([
            'tenant_id' => $tenant->id,
            'code' => 'OWN',
            'name' => 'Own Funds',
            'type' => 'own_funds',
            'currency' => 'NAD',
            'is_active' => true,
        ]);

        $submissions = app(BudgetSubmissionService::class);
        $pack = $submissions->create([
            'budget_cycle_id' => $cycle->id,
            'department_id' => $dept->id,
            'title' => 'Operations 2027/28',
            'items' => [
                [
                    'code' => 'OPS-ADMIN',
                    'name' => 'Admin operations',
                    'category' => 'operational',
                    'funding_source_id' => $source->id,
                    'requested_amount' => 250000,
                ],
                [
                    'code' => 'OPS-TRAVEL',
                    'name' => 'Dept travel',
                    'category' => 'direct_operational',
                    'requested_amount' => 75000,
                ],
            ],
        ], $staff);

        $pack = $submissions->submit($pack, $staff);
        $this->assertSame(BudgetSubmission::STATUS_SUBMITTED, $pack->status);
        $this->assertCount(2, $pack->items);
    }

    public function test_full_path_to_sg_lock_materialises_budget_lines(): void
    {
        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'fy' => $fy, 'cycle' => $cycle] = $this->openCycle($tenant);
        $sg = $this->makeSG($tenant);
        $dept = $this->makeDepartment($tenant);
        $staff = $this->makeUser('staff', $tenant);

        $cycles = app(BudgetCycleService::class);
        $subs = app(BudgetSubmissionService::class);

        $cycles->publishGuidelines($cycle, ['assumptions' => 'Baseline'], $finance);

        $pack = $subs->create([
            'budget_cycle_id' => $cycle->id,
            'department_id' => $dept->id,
            'title' => 'Core pack',
            'items' => [
                ['code' => 'CORE-OPS', 'name' => 'Core Ops', 'requested_amount' => 400000],
                ['code' => 'CORE-PROG', 'name' => 'Programme', 'requested_amount' => 600000],
            ],
        ], $staff);
        $subs->submit($pack, $staff);
        $subs->accept($pack->fresh(), $finance);

        $cycle = $cycles->advance($cycle->fresh(), $finance);
        $this->assertSame(BudgetCycle::STATUS_SUBMITTED_TO_FINANCE, $cycle->status);
        $cycle = $cycles->advance($cycle, $finance);
        $this->assertSame(BudgetCycle::STATUS_FINANCE_REVIEW, $cycle->status);
        $cycle = $cycles->advance($cycle, $finance);
        $this->assertSame(BudgetCycle::STATUS_MANAGEMENT_REVIEW, $cycle->status);

        $cycle = $cycles->sgApprove($cycle, $sg, 'Approved for institutional path');
        $this->assertSame(BudgetCycle::STATUS_FSC_REVIEW, $cycle->status);
        $this->assertSame(1000000.0, (float) $cycle->approved_total);
        $this->assertNotNull($cycle->sg_approved_at);

        try {
            $cycles->lock($cycle->fresh(), $finance);
            $this->fail('Lock must wait for Plenary approval');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('status', $e->errors());
        }
    }

    public function test_institutional_path_then_lock_materialises_lines(): void
    {
        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'fy' => $fy, 'cycle' => $cycle] = $this->openCycle($tenant, 2029);
        $sg = $this->makeSG($tenant);
        $gov = $this->makeGovernanceOfficer($tenant);
        $staff = $this->makeUser('staff', $tenant);

        $cycles = app(BudgetCycleService::class);
        $subs = app(BudgetSubmissionService::class);

        $cycles->publishGuidelines($cycle, ['assumptions' => 'Baseline'], $finance);
        $pack = $subs->create([
            'budget_cycle_id' => $cycle->id,
            'title' => 'Core pack',
            'items' => [
                ['code' => 'CORE-OPS', 'name' => 'Core Ops', 'requested_amount' => 400000],
                ['code' => 'CORE-PROG', 'name' => 'Programme', 'requested_amount' => 600000],
            ],
        ], $staff);
        $subs->submit($pack, $staff);

        $cycle = $cycles->advance($cycle->fresh(), $finance);
        $cycle = $cycles->advance($cycle, $finance);
        $cycle = $cycles->advance($cycle, $finance);
        $cycle = $cycles->sgApprove($cycle, $sg);

        $cycle = $this->recordInstitutionalApprovals($cycle, $gov);
        $this->assertSame(BudgetCycle::STATUS_PLENARY_APPROVED, $cycle->status);

        $cycle = $cycles->lock($cycle, $finance);
        $this->assertSame(BudgetCycle::STATUS_ACTIVE, $cycle->status);

        $budget = Budget::query()
            ->where('tenant_id', $tenant->id)
            ->where('financial_year_id', $fy->id)
            ->first();
        $this->assertNotNull($budget);
        $lines = BudgetLine::query()->where('budget_id', $budget->id)->get();
        $this->assertCount(2, $lines);

        $availability = app(BudgetAvailabilityService::class)->check($lines->firstWhere('code', 'CORE-OPS')->id);
        $this->assertSame(400000.0, $availability['available']);
    }

    public function test_non_approved_institutional_decision_returns_to_finance_review(): void
    {
        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'cycle' => $cycle] = $this->openCycle($tenant, 2030);
        $sg = $this->makeSG($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $cycles = app(BudgetCycleService::class);
        $subs = app(BudgetSubmissionService::class);
        $decisions = app(BudgetInstitutionalDecisionService::class);

        $cycles->publishGuidelines($cycle, ['assumptions' => 'x'], $finance);
        $pack = $subs->create([
            'budget_cycle_id' => $cycle->id,
            'title' => 'Pack',
            'items' => [['code' => 'A1', 'name' => 'A', 'requested_amount' => 1000]],
        ], $staff);
        $subs->submit($pack, $staff);
        $cycle = $cycles->advance($cycle->fresh(), $finance);
        $cycle = $cycles->advance($cycle, $finance);
        $cycle = $cycles->advance($cycle, $finance);
        $cycle = $cycles->sgApprove($cycle, $sg);

        $decisions->record($cycle, [
            'body' => BudgetCycleDecision::BODY_FSC,
            'decision' => BudgetCycleDecision::DECISION_DEFERRED,
            'comments' => 'Need more detail on travel envelope',
        ], $finance);

        $this->assertSame(BudgetCycle::STATUS_FINANCE_REVIEW, $cycle->fresh()->status);
    }

    public function test_staff_cannot_lock_and_requester_cannot_sg_approve_without_role(): void
    {
        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'cycle' => $cycle] = $this->openCycle($tenant, 2031);
        $staff = $this->makeUser('staff', $tenant);
        $cycles = app(BudgetCycleService::class);
        $subs = app(BudgetSubmissionService::class);

        $cycles->publishGuidelines($cycle, ['assumptions' => 'x'], $finance);
        $pack = $subs->create([
            'budget_cycle_id' => $cycle->id,
            'title' => 'Pack',
            'items' => [['code' => 'A1', 'name' => 'A', 'requested_amount' => 1000]],
        ], $staff);
        $subs->submit($pack, $staff);

        $cycle = $cycles->advance($cycle->fresh(), $finance);
        $cycle = $cycles->advance($cycle, $finance);
        $cycle = $cycles->advance($cycle, $finance);
        $this->assertSame(BudgetCycle::STATUS_MANAGEMENT_REVIEW, $cycle->status);

        try {
            $cycles->sgApprove($cycle, $staff);
            $this->fail('Expected 403 for staff SG approve');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
        }

        $sg = $this->makeSG($tenant);
        $cycle = $cycles->sgApprove($cycle->fresh(), $sg);
        $this->assertSame(BudgetCycle::STATUS_FSC_REVIEW, $cycle->status);

        try {
            $cycles->lock($cycle, $staff);
            $this->fail('Expected 403 for staff lock');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
        }

        $cycle = $this->recordInstitutionalApprovals($cycle, $finance);

        try {
            $cycles->lock($cycle->fresh(), $staff);
            $this->fail('Expected 403 for staff lock after plenary');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
        }

        $cycle = $cycles->lock($cycle->fresh(), $finance);
        $this->assertSame(BudgetCycle::STATUS_ACTIVE, $cycle->status);
    }

    public function test_http_cycle_endpoints(): void
    {
        $tenant = Tenant::factory()->create();
        $finance = $this->makeFinanceController($tenant);
        $fy = FinancialYear::defaultAprilMarch($tenant->id, 2028);

        $this->asUser($finance)
            ->postJson('/api/v1/budget/cycles', ['financial_year_id' => $fy->id])
            ->assertCreated()
            ->assertJsonPath('data.status', BudgetCycle::STATUS_PLANNING);

        $cycleId = BudgetCycle::query()->where('tenant_id', $tenant->id)->value('id');

        $this->asUser($finance)
            ->postJson("/api/v1/budget/cycles/{$cycleId}/guidelines", [
                'assumptions' => 'HTTP test',
                'inflation_rate' => 4.5,
            ])
            ->assertOk();

        $this->asUser($finance)
            ->postJson('/api/v1/budget/submissions', [
                'budget_cycle_id' => $cycleId,
                'title' => 'HTTP pack',
                'items' => [
                    ['code' => 'HTTP-1', 'name' => 'Line', 'requested_amount' => 50000],
                ],
            ])
            ->assertCreated();

        $submissionId = BudgetSubmission::query()->where('budget_cycle_id', $cycleId)->value('id');

        $this->asUser($finance)
            ->postJson("/api/v1/budget/submissions/{$submissionId}/submit")
            ->assertOk()
            ->assertJsonPath('data.status', BudgetSubmission::STATUS_SUBMITTED);
    }
}
