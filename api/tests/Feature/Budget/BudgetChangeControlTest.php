<?php

namespace Tests\Feature\Budget;

use App\Models\Budget;
use App\Models\BudgetChangeRequest;
use App\Models\BudgetLine;
use App\Models\FinancialYear;
use App\Models\Tenant;
use App\Modules\Budget\Services\BudgetAvailabilityService;
use App\Modules\Budget\Services\BudgetChangeApplyService;
use App\Modules\Budget\Services\BudgetChangeRequestService;
use App\Modules\Budget\Services\BudgetCommitmentService;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class BudgetChangeControlTest extends TestCase
{
    private function seedActiveBudget(Tenant $tenant, float $a = 100000, float $b = 50000, float $contingency = 20000): array
    {
        $finance = $this->makeFinanceController($tenant);
        $fy = FinancialYear::defaultAprilMarch($tenant->id, 2026);
        $budget = Budget::create([
            'tenant_id' => $tenant->id,
            'financial_year_id' => $fy->id,
            'year' => '2026',
            'name' => 'FY Active',
            'type' => 'core',
            'status' => 'active',
            'currency' => 'NAD',
            'total_amount' => $a + $b + $contingency,
            'created_by' => $finance->id,
        ]);

        $lineA = BudgetLine::create([
            'budget_id' => $budget->id,
            'code' => 'A-OPS',
            'name' => 'Ops A',
            'category' => 'operational',
            'amount_allocated' => $a,
            'original_allocation' => $a,
            'amount_spent' => 0,
            'is_active' => true,
        ]);
        $lineB = BudgetLine::create([
            'budget_id' => $budget->id,
            'code' => 'B-PROG',
            'name' => 'Prog B',
            'category' => 'programme',
            'amount_allocated' => $b,
            'original_allocation' => $b,
            'amount_spent' => 0,
            'is_active' => true,
        ]);
        $lineC = BudgetLine::create([
            'budget_id' => $budget->id,
            'code' => 'CONT',
            'name' => 'Contingency',
            'category' => 'contingency',
            'amount_allocated' => $contingency,
            'original_allocation' => $contingency,
            'amount_spent' => 0,
            'is_active' => true,
            'is_contingency' => true,
        ]);

        return compact('finance', 'fy', 'budget', 'lineA', 'lineB', 'lineC');
    }

    public function test_transfer_apply_moves_allocation(): void
    {
        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'budget' => $budget, 'lineA' => $a, 'lineB' => $b] = $this->seedActiveBudget($tenant);
        $svc = app(BudgetChangeRequestService::class);
        $apply = app(BudgetChangeApplyService::class);

        $req = $svc->create([
            'budget_id' => $budget->id,
            'type' => BudgetChangeRequest::TYPE_TRANSFER,
            'title' => 'Move 10k A→B',
            'items' => [[
                'source_budget_line_id' => $a->id,
                'target_budget_line_id' => $b->id,
                'amount' => 10000,
            ]],
        ], $finance);

        $this->assertFalse($req->requires_sg);
        $req = $svc->submit($req, $finance);
        $req = $svc->financeDecide($req, 'approve', $finance);
        $this->assertSame(BudgetChangeRequest::STATUS_APPROVED, $req->status);

        $req = $apply->apply($req, $finance);
        $this->assertSame(BudgetChangeRequest::STATUS_APPLIED, $req->status);

        $this->assertSame(90000.0, $a->fresh()->currentApprovedAllocation());
        $this->assertSame(60000.0, $b->fresh()->currentApprovedAllocation());
    }

    public function test_small_revision_finance_only_large_needs_sg(): void
    {
        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'budget' => $budget, 'lineA' => $a] = $this->seedActiveBudget($tenant);
        $svc = app(BudgetChangeRequestService::class);

        $small = $svc->create([
            'budget_id' => $budget->id,
            'type' => BudgetChangeRequest::TYPE_REVISION,
            'title' => 'Small +5%',
            'items' => [['target_budget_line_id' => $a->id, 'amount' => 5000]],
        ], $finance);
        $this->assertFalse($small->requires_sg);

        $large = $svc->create([
            'budget_id' => $budget->id,
            'type' => BudgetChangeRequest::TYPE_REVISION,
            'title' => 'Large +20%',
            'items' => [['target_budget_line_id' => $a->id, 'amount' => 20000]],
        ], $finance);
        $this->assertTrue($large->requires_sg);

        $large = $svc->submit($large, $finance);
        $large = $svc->financeDecide($large, 'approve', $finance);
        $this->assertSame(BudgetChangeRequest::STATUS_PENDING_SG, $large->status);

        $sg = $this->makeSG($tenant);
        $large = $svc->sgDecide($large, 'approve', $sg);
        $this->assertSame(BudgetChangeRequest::STATUS_APPROVED, $large->status);

        app(BudgetChangeApplyService::class)->apply($large, $finance);
        $this->assertSame(120000.0, $a->fresh()->currentApprovedAllocation());
    }

    public function test_contingency_rejects_non_contingency_source(): void
    {
        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'budget' => $budget, 'lineA' => $a, 'lineB' => $b] = $this->seedActiveBudget($tenant);
        $svc = app(BudgetChangeRequestService::class);

        $req = $svc->create([
            'budget_id' => $budget->id,
            'type' => BudgetChangeRequest::TYPE_CONTINGENCY,
            'title' => 'Bad contingency',
            'items' => [[
                'source_budget_line_id' => $a->id,
                'target_budget_line_id' => $b->id,
                'amount' => 1000,
            ]],
        ], $finance);

        $this->expectException(ValidationException::class);
        $svc->submit($req, $finance);
    }

    public function test_contingency_and_supplementary_apply(): void
    {
        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'budget' => $budget, 'lineB' => $b, 'lineC' => $c] = $this->seedActiveBudget($tenant);
        $svc = app(BudgetChangeRequestService::class);
        $apply = app(BudgetChangeApplyService::class);
        $sg = $this->makeSG($tenant);

        $cont = $svc->create([
            'budget_id' => $budget->id,
            'type' => BudgetChangeRequest::TYPE_CONTINGENCY,
            'title' => 'Draw contingency',
            'items' => [[
                'source_budget_line_id' => $c->id,
                'target_budget_line_id' => $b->id,
                'amount' => 5000,
            ]],
        ], $finance);
        $cont = $svc->submit($cont, $finance);
        $cont = $svc->financeDecide($cont, 'approve', $finance);
        $cont = $svc->sgDecide($cont, 'approve', $sg);
        $apply->apply($cont, $finance);

        $this->assertSame(15000.0, $c->fresh()->currentApprovedAllocation());
        $this->assertSame(55000.0, $b->fresh()->currentApprovedAllocation());

        $sup = $svc->create([
            'budget_id' => $budget->id,
            'type' => BudgetChangeRequest::TYPE_SUPPLEMENTARY,
            'title' => 'New line',
            'items' => [[
                'new_line_code' => 'SUP-NEW',
                'new_line_name' => 'Supplementary New',
                'new_line_category' => 'operational',
                'amount' => 25000,
            ]],
        ], $finance);
        $sup = $svc->submit($sup, $finance);
        $sup = $svc->financeDecide($sup, 'approve', $finance);
        $sup = $svc->sgDecide($sup, 'approve', $sg);
        $apply->apply($sup, $finance);

        $new = BudgetLine::query()->where('budget_id', $budget->id)->where('code', 'SUP-NEW')->first();
        $this->assertNotNull($new);
        $this->assertSame(25000.0, $new->currentApprovedAllocation());
    }

    public function test_apply_blocked_when_insufficient_available(): void
    {
        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'budget' => $budget, 'lineA' => $a, 'lineB' => $b] = $this->seedActiveBudget($tenant, 100000, 50000, 0);

        app(BudgetCommitmentService::class)->reserve([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $a->id,
            'amount' => 95000,
            'source_type' => 'manual',
            'source_id' => 1,
            'source_key' => 'MANUAL:block',
        ], $finance);

        $svc = app(BudgetChangeRequestService::class);
        $req = $svc->create([
            'budget_id' => $budget->id,
            'type' => BudgetChangeRequest::TYPE_TRANSFER,
            'title' => 'Too much',
            'items' => [[
                'source_budget_line_id' => $a->id,
                'target_budget_line_id' => $b->id,
                'amount' => 10000,
            ]],
        ], $finance);
        $req = $svc->submit($req, $finance);
        $req = $svc->financeDecide($req, 'approve', $finance);

        $this->expectException(ValidationException::class);
        app(BudgetChangeApplyService::class)->apply($req, $finance);
    }

    public function test_http_change_endpoints(): void
    {
        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'budget' => $budget, 'lineA' => $a, 'lineB' => $b] = $this->seedActiveBudget($tenant);

        $this->asUser($finance)
            ->postJson('/api/v1/budget/changes', [
                'budget_id' => $budget->id,
                'type' => 'transfer',
                'title' => 'HTTP transfer',
                'items' => [[
                    'source_budget_line_id' => $a->id,
                    'target_budget_line_id' => $b->id,
                    'amount' => 1000,
                ]],
            ])
            ->assertCreated()
            ->assertJsonPath('data.requires_sg', false);

        $id = BudgetChangeRequest::query()->where('tenant_id', $tenant->id)->value('id');

        $this->asUser($finance)->postJson("/api/v1/budget/changes/{$id}/submit")->assertOk();
        $this->asUser($finance)
            ->postJson("/api/v1/budget/changes/{$id}/finance-decide", ['decision' => 'approve'])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');
        $this->asUser($finance)->postJson("/api/v1/budget/changes/{$id}/apply")->assertOk()
            ->assertJsonPath('data.status', 'applied');

        $avail = app(BudgetAvailabilityService::class)->check($a->id);
        $this->assertSame(99000.0, $avail['approved']);
    }
}
