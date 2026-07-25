<?php

namespace Tests\Feature\Procurement;

use App\Models\ProcurementQuote;
use App\Models\ProcurementRequest;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\Vendor;
use Tests\TestCase;

class AiComparisonSummaryTest extends TestCase
{
    public function test_comparison_summary_requires_feature_flag(): void
    {
        $tenant = Tenant::factory()->create([
            'settings' => ['procurement' => ['ai_comparison_enabled' => false]],
        ]);
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $tender = $this->makeOpenedTender($tenant, $officer);

        $http->postJson("/api/v1/procurement/tenders/{$tender->id}/comparison-summary")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['ai_comparison']);
    }

    public function test_stub_summary_is_assistive_only_and_does_not_award(): void
    {
        $tenant = Tenant::factory()->create([
            'settings' => ['procurement' => ['ai_comparison_enabled' => true]],
        ]);
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $tender = $this->makeOpenedTender($tenant, $officer);

        $vendorA = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'Alpha Supplies', 'is_approved' => true, 'is_active' => true]);
        $vendorB = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'Beta Goods', 'is_approved' => true, 'is_active' => true]);

        ProcurementQuote::create([
            'procurement_request_id' => $tender->procurement_request_id,
            'vendor_id'              => $vendorA->id,
            'vendor_name'            => 'Alpha Supplies',
            'quoted_amount'          => 120_000,
            'currency'               => 'NAD',
            'technical_score'        => 85,
            'financial_score'        => 70,
            'is_current'             => true,
            'quote_date'             => now()->toDateString(),
        ]);
        ProcurementQuote::create([
            'procurement_request_id' => $tender->procurement_request_id,
            'vendor_id'              => $vendorB->id,
            'vendor_name'            => 'Beta Goods',
            'quoted_amount'          => 110_000,
            'currency'               => 'NAD',
            'technical_score'        => 78,
            'financial_score'        => 90,
            'is_current'             => true,
            'quote_date'             => now()->toDateString(),
        ]);

        $response = $http->postJson("/api/v1/procurement/tenders/{$tender->id}/comparison-summary")
            ->assertOk()
            ->assertJsonPath('data.source', 'stub')
            ->assertJsonPath('data.is_recommendation', false)
            ->assertJsonPath('data.auto_award', false);

        $this->assertNotEmpty($response->json('data.summary'));
        $this->assertNotEmpty($response->json('data.disclaimer'));
        $this->assertStringContainsString('human', strtolower($response->json('data.disclaimer')));

        // Must not mutate recommendations / award state
        $this->assertDatabaseMissing('procurement_quotes', [
            'procurement_request_id' => $tender->procurement_request_id,
            'is_recommended'         => true,
        ]);
        $tender->refresh();
        $this->assertSame(Tender::STATUS_OPENED, $tender->status);
    }

    private function makeOpenedTender(Tenant $tenant, $officer): Tender
    {
        $req = ProcurementRequest::create([
            'tenant_id'          => $tenant->id,
            'requester_id'       => $officer->id,
            'title'              => 'Compare Me',
            'description'        => 'x',
            'category'           => 'goods',
            'estimated_value'    => 200_000,
            'currency'           => 'NAD',
            'status'             => 'approved',
            'procurement_method' => 'tender',
        ]);

        return Tender::create([
            'tenant_id'              => $tenant->id,
            'procurement_request_id' => $req->id,
            'reference_number'       => 'TND-AI1',
            'title'                  => 'AI Compare Tender',
            'status'                 => Tender::STATUS_OPENED,
            'sealed_mode'            => true,
            'bids_opened_at'         => now(),
            'technical_weight'       => 80,
            'financial_weight'       => 20,
            'min_technical_score'    => 70,
            'created_by'             => $officer->id,
        ]);
    }
}
