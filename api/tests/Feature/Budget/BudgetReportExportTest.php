<?php

namespace Tests\Feature\Budget;

use App\Models\Budget;
use App\Models\BudgetLine;
use App\Models\FinancialYear;
use App\Models\FundingSource;
use App\Models\Tenant;
use Tests\TestCase;

class BudgetReportExportTest extends TestCase
{
    private function seedLine(Tenant $tenant): void
    {
        $finance = $this->makeFinanceController($tenant);
        $fy = FinancialYear::defaultAprilMarch($tenant->id, 2026);
        $source = FundingSource::create([
            'tenant_id' => $tenant->id,
            'code' => 'CORE-'.substr(uniqid(), -4),
            'name' => 'Own Funds',
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
            'total_amount' => 10000,
            'created_by' => $finance->id,
        ]);
        BudgetLine::create([
            'budget_id' => $budget->id,
            'code' => 'OPS-'.substr(uniqid(), -4),
            'name' => 'Operations',
            'funding_source_id' => $source->id,
            'department_id' => $dept->id,
            'category' => 'operational',
            'amount_allocated' => 10000,
            'original_allocation' => 10000,
            'amount_spent' => 0,
            'is_active' => true,
        ]);
    }

    public function test_utilisation_xlsx_export_returns_spreadsheet(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $this->seedLine($tenant);

        $res = $this->asUser($admin)
            ->get('/api/v1/budget/reports/utilisation/export?format=xlsx')
            ->assertOk();

        $contentType = strtolower((string) $res->headers->get('content-type'));
        $this->assertTrue(
            str_contains($contentType, 'spreadsheet') || str_contains($contentType, 'octet-stream'),
            "Unexpected content-type: {$contentType}"
        );
        $body = $res->streamedContent();
        $this->assertNotSame('', $body);
        $this->assertSame("PK\x03\x04", substr($body, 0, 4));
    }

    public function test_utilisation_pdf_export_returns_pdf(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $this->seedLine($tenant);

        $res = $this->asUser($admin)
            ->get('/api/v1/budget/reports/utilisation/export?format=pdf')
            ->assertOk();

        $contentType = strtolower((string) $res->headers->get('content-type'));
        $this->assertTrue(str_contains($contentType, 'pdf'), "Unexpected content-type: {$contentType}");
        $this->assertNotEmpty($res->getContent());
    }
}