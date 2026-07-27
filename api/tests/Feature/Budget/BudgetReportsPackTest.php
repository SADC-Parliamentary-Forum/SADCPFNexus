<?php

namespace Tests\Feature\Budget;

use App\Models\Budget;
use App\Models\BudgetChangeRequest;
use App\Models\BudgetCycle;
use App\Models\BudgetGuideline;
use App\Models\BudgetLine;
use App\Models\BudgetReservation;
use App\Models\FinancialYear;
use App\Models\FundingSource;
use App\Models\Tenant;
use App\Modules\Budget\Services\BudgetActualService;
use App\Modules\Budget\Services\BudgetChangeRequestService;
use App\Modules\Budget\Services\BudgetCommitmentService;
use Carbon\Carbon;
use Tests\TestCase;

class BudgetReportsPackTest extends TestCase
{
    private function seedLine(Tenant $tenant, float $allocated = 100000, array $overrides = []): array
    {
        $finance = $this->makeFinanceController($tenant);
        $fy = FinancialYear::defaultAprilMarch($tenant->id, 2026);
        $source = FundingSource::create([
            'tenant_id' => $tenant->id,
            'code' => 'CORE-'.substr(uniqid(), -4),
            'name' => 'SADC PF Own Funds',
            'type' => 'own_funds',
            'currency' => 'NAD',
            'is_active' => true,
        ]);
        $dept = $this->makeDepartment($tenant);
        $budget = Budget::create([
            'tenant_id' => $tenant->id,
            'financial_year_id' => $fy->id,
            'year' => '2026',
            'name' => 'FY 2026/27 Core',
            'type' => 'core',
            'status' => 'active',
            'currency' => 'NAD',
            'total_amount' => $allocated,
            'created_by' => $finance->id,
        ]);
        $line = BudgetLine::create(array_merge([
            'budget_id' => $budget->id,
            'code' => 'OPS-'.substr(uniqid(), -4),
            'name' => 'Operations',
            'funding_source_id' => $source->id,
            'department_id' => $dept->id,
            'category' => 'operational',
            'amount_allocated' => $allocated,
            'original_allocation' => $allocated,
            'amount_spent' => 0,
            'is_active' => true,
        ], $overrides));

        return compact('finance', 'fy', 'source', 'dept', 'budget', 'line');
    }

    public function test_utilisation_report_by_line_includes_pct_utilised(): void
    {
        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'fy' => $fy, 'line' => $line, 'dept' => $dept, 'source' => $source] =
            $this->seedLine($tenant, 100000);

        app(BudgetCommitmentService::class)->reserve([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $line->id,
            'amount' => 30000,
            'source_type' => 'manual',
            'source_id' => 1,
            'source_key' => 'MANUAL:UTIL-1',
            'currency' => 'NAD',
        ], $finance);

        app(BudgetActualService::class)->post([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $line->id,
            'accounting_reference' => 'INV-UTIL-1',
            'transaction_date' => '2026-05-15',
            'amount' => 20000,
            'currency' => 'NAD',
        ], $finance);

        $response = $this->asUser($finance)
            ->getJson('/api/v1/budget/reports/utilisation?'.http_build_query([
                'financial_year_id' => $fy->id,
                'group_by' => 'line',
            ]))
            ->assertOk()
            ->assertJsonPath('success', true);

        $rows = $response->json('data.rows');
        $this->assertNotEmpty($rows);
        $row = collect($rows)->firstWhere('budget_line_id', $line->id);
        $this->assertNotNull($row);
        $this->assertSame(100000.0, (float) $row['approved']);
        $this->assertSame(20000.0, (float) $row['actual']);
        $this->assertSame(30000.0, (float) $row['committed']);
        $this->assertSame(50000.0, (float) $row['available']);
        $this->assertSame(50.0, (float) $row['pct_utilised']);
        $this->assertSame($dept->id, $row['department_id']);
        $this->assertSame($source->id, $row['funding_source_id']);
    }

    public function test_utilisation_report_rolls_up_by_department(): void
    {
        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'fy' => $fy, 'dept' => $dept] = $this->seedLine($tenant, 80000);
        $this->seedLine($tenant, 20000, ['department_id' => $dept->id]);

        $response = $this->asUser($finance)
            ->getJson('/api/v1/budget/reports/utilisation?'.http_build_query([
                'financial_year_id' => $fy->id,
                'group_by' => 'department',
                'department_id' => $dept->id,
            ]))
            ->assertOk();

        $rows = $response->json('data.rows');
        $this->assertCount(1, $rows);
        $this->assertSame($dept->id, $rows[0]['department_id']);
        $this->assertSame(100000.0, (float) $rows[0]['approved']);
    }

    public function test_commitment_ageing_buckets_open_commitments(): void
    {
        Carbon::setTestNow('2026-07-27 12:00:00');

        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'fy' => $fy, 'line' => $line] = $this->seedLine($tenant, 200000);
        $svc = app(BudgetCommitmentService::class);

        $fresh = $svc->reserve([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $line->id,
            'amount' => 10000,
            'source_type' => 'travel',
            'source_id' => 11,
            'source_key' => 'TRAVEL:11',
        ], $finance);
        BudgetReservation::whereKey($fresh->id)->update([
            'reserved_at' => Carbon::now()->subDays(10),
            'created_at' => Carbon::now()->subDays(10),
        ]);

        $mid = $svc->reserve([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $line->id,
            'amount' => 20000,
            'source_type' => 'procurement',
            'source_id' => 22,
            'source_key' => 'PROC:22',
        ], $finance);
        BudgetReservation::whereKey($mid->id)->update([
            'reserved_at' => Carbon::now()->subDays(45),
            'created_at' => Carbon::now()->subDays(45),
        ]);

        $old = $svc->reserve([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $line->id,
            'amount' => 30000,
            'source_type' => 'imprest',
            'source_id' => 33,
            'source_key' => 'IMPREST:33',
        ], $finance);
        BudgetReservation::whereKey($old->id)->update([
            'reserved_at' => Carbon::now()->subDays(120),
            'created_at' => Carbon::now()->subDays(120),
        ]);

        $response = $this->asUser($finance)
            ->getJson('/api/v1/budget/reports/commitment-ageing?'.http_build_query([
                'financial_year_id' => $fy->id,
            ]))
            ->assertOk();

        $buckets = $response->json('data.buckets');
        $this->assertSame(10000.0, (float) $buckets['0_30']['amount']);
        $this->assertSame(1, $buckets['0_30']['count']);
        $this->assertSame(20000.0, (float) $buckets['31_60']['amount']);
        $this->assertSame(30000.0, (float) $buckets['90_plus']['amount']);

        $items = $response->json('data.items');
        $this->assertCount(3, $items);
        $travel = collect($items)->firstWhere('source_key', 'TRAVEL:11');
        $this->assertSame('travel', $travel['source_type']);
        $this->assertSame('0_30', $travel['age_bucket']);

        Carbon::setTestNow();
    }

    public function test_change_request_register_includes_amounts_and_approver_path(): void
    {
        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'fy' => $fy, 'budget' => $budget, 'line' => $lineA] =
            $this->seedLine($tenant, 100000);
        $lineB = BudgetLine::create([
            'budget_id' => $budget->id,
            'code' => 'PROG-B',
            'name' => 'Prog B',
            'category' => 'programme',
            'amount_allocated' => 50000,
            'original_allocation' => 50000,
            'amount_spent' => 0,
            'is_active' => true,
        ]);

        $svc = app(BudgetChangeRequestService::class);
        $req = $svc->create([
            'budget_id' => $budget->id,
            'type' => BudgetChangeRequest::TYPE_TRANSFER,
            'title' => 'Move 10k',
            'items' => [[
                'source_budget_line_id' => $lineA->id,
                'target_budget_line_id' => $lineB->id,
                'amount' => 10000,
            ]],
        ], $finance);
        $req = $svc->submit($req, $finance);
        $req = $svc->financeDecide($req, 'approve', $finance);

        $response = $this->asUser($finance)
            ->getJson('/api/v1/budget/reports/change-register?'.http_build_query([
                'financial_year_id' => $fy->id,
            ]))
            ->assertOk();

        $rows = $response->json('data.rows');
        $this->assertNotEmpty($rows);
        $row = collect($rows)->firstWhere('id', $req->id);
        $this->assertNotNull($row);
        $this->assertSame(BudgetChangeRequest::TYPE_TRANSFER, $row['type']);
        $this->assertSame(BudgetChangeRequest::STATUS_APPROVED, $row['status']);
        $this->assertSame(10000.0, (float) $row['total_amount']);
        $this->assertNotEmpty($row['approver_path']);
        $this->assertNotNull($row['submitted_at']);
        $this->assertNotNull($row['finance_decided_at']);
    }

    public function test_cycle_status_overview_summarises_stages_and_dates(): void
    {
        $tenant = Tenant::factory()->create();
        $finance = $this->makeFinanceController($tenant);
        $fy = FinancialYear::defaultAprilMarch($tenant->id, 2026);

        $cycle = BudgetCycle::create([
            'tenant_id' => $tenant->id,
            'financial_year_id' => $fy->id,
            'status' => BudgetCycle::STATUS_DEPARTMENT_PREPARATION,
            'opened_by' => $finance->id,
            'opened_at' => now()->subDays(14),
            'notes' => 'FY planning',
        ]);

        BudgetGuideline::create([
            'budget_cycle_id' => $cycle->id,
            'submission_opens_on' => '2026-04-01',
            'department_deadline' => '2026-05-15',
            'assumptions' => 'Flat growth',
            'published_by' => $finance->id,
            'published_at' => now()->subDays(10),
        ]);

        $response = $this->asUser($finance)
            ->getJson('/api/v1/budget/reports/cycle-status?'.http_build_query([
                'financial_year_id' => $fy->id,
            ]))
            ->assertOk();

        $rows = $response->json('data.rows');
        $this->assertCount(1, $rows);
        $this->assertSame($cycle->id, $rows[0]['id']);
        $this->assertSame(BudgetCycle::STATUS_DEPARTMENT_PREPARATION, $rows[0]['status']);
        $this->assertSame('2026-05-15', $rows[0]['department_deadline']);
        $this->assertSame('2026-04-01', $rows[0]['submission_opens_on']);
        $this->assertArrayHasKey('submission_counts', $rows[0]);
    }

    public function test_reports_require_authentication(): void
    {
        $this->getJson('/api/v1/budget/reports/utilisation')->assertUnauthorized();
        $this->getJson('/api/v1/budget/reports/commitment-ageing')->assertUnauthorized();
        $this->getJson('/api/v1/budget/reports/change-register')->assertUnauthorized();
        $this->getJson('/api/v1/budget/reports/cycle-status')->assertUnauthorized();
    }
}
