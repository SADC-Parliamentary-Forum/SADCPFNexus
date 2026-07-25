<?php

namespace Tests\Feature\Procurement;

use App\Models\ProcurementQuote;
use App\Models\ProcurementRequest;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\Vendor;
use Tests\TestCase;

class TwoEnvelopeScoringTest extends TestCase
{
    public function test_can_record_technical_score_while_sealed_but_not_financial(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);

        $req = ProcurementRequest::create([
            'tenant_id'          => $tenant->id,
            'requester_id'       => $officer->id,
            'title'              => 'Two Envelope',
            'description'        => 'x',
            'category'           => 'services',
            'estimated_value'    => 300_000,
            'currency'           => 'NAD',
            'status'             => 'approved',
            'procurement_method' => 'tender',
        ]);

        $tender = Tender::create([
            'tenant_id'              => $tenant->id,
            'procurement_request_id' => $req->id,
            'reference_number'       => 'TND-ENV1',
            'title'                  => 'Sealed Eval',
            'status'                 => Tender::STATUS_PUBLISHED,
            'sealed_mode'            => true,
            'published_at'           => now(),
            'technical_weight'       => 80,
            'financial_weight'       => 20,
            'min_technical_score'    => 70,
            'created_by'             => $officer->id,
        ]);

        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'Env Vendor', 'is_approved' => true, 'is_active' => true]);
        $quote = ProcurementQuote::create([
            'procurement_request_id' => $req->id,
            'vendor_id'              => $vendor->id,
            'vendor_name'            => $vendor->name,
            'quoted_amount'          => 150_000,
            'currency'               => 'NAD',
            'is_current'             => true,
            'quote_date'             => now()->toDateString(),
            'envelope'               => 'technical',
        ]);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/coi-declarations", [
            'context'      => 'assess',
            'has_conflict' => false,
        ])->assertCreated();

        $http->postJson("/api/v1/procurement/requests/{$req->id}/quotes/{$quote->id}/assess", [
            'compliance_passed' => true,
            'technical_score'   => 82,
            'financial_score'   => 90,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['financial_score']);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/quotes/{$quote->id}/assess", [
            'compliance_passed' => true,
            'technical_score'   => 82,
        ])->assertOk()
            ->assertJsonPath('data.technical_score', 82);

        $tender->update([
            'status'         => Tender::STATUS_OPENED,
            'bids_opened_at' => now(),
            'closed_at'      => now(),
        ]);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/quotes/{$quote->id}/assess", [
            'compliance_passed' => true,
            'technical_score'   => 82,
            'financial_score'   => 88,
        ])->assertOk()
            ->assertJsonPath('data.financial_score', 88);
    }

    public function test_evaluations_payload_includes_weights_and_combined_when_open(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);

        $req = ProcurementRequest::create([
            'tenant_id'          => $tenant->id,
            'requester_id'       => $officer->id,
            'title'              => 'Weights',
            'description'        => 'x',
            'category'           => 'goods',
            'estimated_value'    => 200_000,
            'currency'           => 'NAD',
            'status'             => 'approved',
            'procurement_method' => 'tender',
        ]);

        Tender::create([
            'tenant_id'              => $tenant->id,
            'procurement_request_id' => $req->id,
            'reference_number'       => 'TND-W1',
            'title'                  => 'Weighted',
            'status'                 => Tender::STATUS_EVALUATING,
            'sealed_mode'            => true,
            'bids_opened_at'         => now(),
            'evaluation_started_at'  => now(),
            'technical_weight'       => 70,
            'financial_weight'       => 30,
            'min_technical_score'    => 65,
            'created_by'             => $officer->id,
        ]);

        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'Score Vendor', 'is_approved' => true, 'is_active' => true]);
        ProcurementQuote::create([
            'procurement_request_id' => $req->id,
            'vendor_id'              => $vendor->id,
            'vendor_name'            => $vendor->name,
            'quoted_amount'          => 99_000,
            'currency'               => 'NAD',
            'technical_score'        => 80,
            'financial_score'        => 90,
            'is_current'             => true,
            'quote_date'             => now()->toDateString(),
        ]);

        $http->getJson('/api/v1/procurement/evaluations')
            ->assertOk()
            ->assertJsonPath('data.0.technical_weight', 70)
            ->assertJsonPath('data.0.financial_weight', 30)
            ->assertJsonPath('data.0.min_technical_score', 65)
            ->assertJsonPath('data.0.scoring.0.combined_score', 83);
    }
}
