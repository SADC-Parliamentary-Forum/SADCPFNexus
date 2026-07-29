<?php

namespace Tests\Feature\Procurement;

use App\Models\AuditLog;
use App\Models\ProcurementQuote;
use App\Models\ProcurementRequest;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\Vendor;
use Illuminate\Support\Facades\Http;
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
        $this->seedQuotes($tenant, $tender);

        $response = $http->postJson("/api/v1/procurement/tenders/{$tender->id}/comparison-summary")
            ->assertOk()
            ->assertJsonPath('data.source', 'stub')
            ->assertJsonPath('data.is_recommendation', false)
            ->assertJsonPath('data.auto_award', false)
            ->assertJsonPath('data.requires_human_confirm', true);

        $this->assertNotEmpty($response->json('data.summary'));
        $this->assertNotEmpty($response->json('data.disclaimer'));
        $this->assertStringContainsString('human', strtolower($response->json('data.disclaimer')));

        $this->assertDatabaseMissing('procurement_quotes', [
            'procurement_request_id' => $tender->procurement_request_id,
            'is_recommended'         => true,
        ]);
        $tender->refresh();
        $this->assertSame(Tender::STATUS_OPENED, $tender->status);
    }

    public function test_llm_provider_falls_back_to_stub_without_credentials(): void
    {
        config([
            'procurement.ai_comparison_provider' => 'llm',
            'procurement.ai_comparison_llm_endpoint' => null,
            'procurement.ai_comparison_llm_api_key' => null,
        ]);

        $tenant = Tenant::factory()->create([
            'settings' => ['procurement' => ['ai_comparison_enabled' => true]],
        ]);
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $tender = $this->makeOpenedTender($tenant, $officer);
        $this->seedQuotes($tenant, $tender);

        $http->postJson("/api/v1/procurement/tenders/{$tender->id}/comparison-summary")
            ->assertOk()
            ->assertJsonPath('data.source', 'stub')
            ->assertJsonPath('data.provider', 'stub')
            ->assertJsonPath('data.auto_award', false);

        $tender->refresh();
        $this->assertSame(Tender::STATUS_OPENED, $tender->status);
    }

    public function test_llm_provider_uses_live_endpoint_when_configured(): void
    {
        config([
            'procurement.ai_comparison_provider' => 'llm',
            'procurement.ai_comparison_llm_endpoint' => 'https://llm.test/v1/compare',
            'procurement.ai_comparison_llm_api_key' => 'test-key-not-real',
        ]);

        Http::fake([
            'https://llm.test/v1/compare' => Http::response([
                'summary' => 'Live assistive narrative for Alpha and Beta.',
            ], 200),
        ]);

        $tenant = Tenant::factory()->create([
            'settings' => ['procurement' => ['ai_comparison_enabled' => true]],
        ]);
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $tender = $this->makeOpenedTender($tenant, $officer);
        $this->seedQuotes($tenant, $tender);

        $response = $http->postJson("/api/v1/procurement/tenders/{$tender->id}/comparison-summary")
            ->assertOk()
            ->assertJsonPath('data.source', 'llm')
            ->assertJsonPath('data.provider', 'llm')
            ->assertJsonPath('data.auto_award', false)
            ->assertJsonPath('data.is_recommendation', false);

        $this->assertStringContainsString('Live assistive', $response->json('data.summary'));
        $this->assertStringContainsString('never awards', strtolower($response->json('data.summary')));

        $this->assertDatabaseMissing('procurement_quotes', [
            'procurement_request_id' => $tender->procurement_request_id,
            'is_recommended'         => true,
        ]);
        $tender->refresh();
        $this->assertSame(Tender::STATUS_OPENED, $tender->status);
    }

    public function test_human_confirm_path_does_not_award(): void
    {
        $tenant = Tenant::factory()->create([
            'settings' => ['procurement' => ['ai_comparison_enabled' => true]],
        ]);
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $tender = $this->makeOpenedTender($tenant, $officer);
        $this->seedQuotes($tenant, $tender);

        $summary = $http->postJson("/api/v1/procurement/tenders/{$tender->id}/comparison-summary")
            ->assertOk()
            ->json('data.summary');

        $http->postJson("/api/v1/procurement/tenders/{$tender->id}/comparison-summary/confirm", [
            'confirm' => true,
            'summary_fingerprint' => substr(hash('sha256', (string) $summary), 0, 32),
        ])
            ->assertOk()
            ->assertJsonPath('data.confirmed', true)
            ->assertJsonPath('data.auto_award', false)
            ->assertJsonPath('data.award_mutated', false)
            ->assertJsonPath('data.tender_status', Tender::STATUS_OPENED);

        $this->assertDatabaseMissing('procurement_quotes', [
            'procurement_request_id' => $tender->procurement_request_id,
            'is_recommended'         => true,
        ]);
        $tender->refresh();
        $this->assertSame(Tender::STATUS_OPENED, $tender->status);
        $this->assertNull($tender->awarded_quote_id ?? null);

        $this->assertTrue(
            AuditLog::query()
                ->where('event', 'procurement.comparison_summary_confirmed')
                ->where('auditable_id', $tender->id)
                ->exists()
        );
    }

    public function test_confirm_requires_accepted_flag(): void
    {
        $tenant = Tenant::factory()->create([
            'settings' => ['procurement' => ['ai_comparison_enabled' => true]],
        ]);
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $tender = $this->makeOpenedTender($tenant, $officer);

        $http->postJson("/api/v1/procurement/tenders/{$tender->id}/comparison-summary/confirm", [
            'confirm' => false,
        ])->assertStatus(422);
    }

    private function seedQuotes(Tenant $tenant, Tender $tender): void
    {
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
