<?php

namespace Tests\Feature\Procurement;

use App\Models\ProcurementQuote;
use App\Models\ProcurementRequest;
use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

class ProcurementCoiTest extends TestCase
{
    private function makeApprovedRequest(Tenant $tenant, int $requesterId): ProcurementRequest
    {
        $req = ProcurementRequest::create([
            'tenant_id'       => $tenant->id,
            'requester_id'    => $requesterId,
            'title'           => 'COI Test Purchase',
            'description'     => 'Testing conflict of interest gates',
            'category'        => 'goods',
            'estimated_value' => 45000,
            'currency'        => 'NAD',
            'status'          => 'approved',
            'submitted_at'    => now()->subDay(),
            'approved_at'     => now(),
            'rfq_issued_at'   => now()->subHours(12),
        ]);
        $this->reserveBudgetFor($req);

        return $req;
    }

    private function makeVendor(Tenant $tenant): Vendor
    {
        return Vendor::create([
            'tenant_id'     => $tenant->id,
            'name'          => 'COI Vendor',
            'contact_email' => 'coi@vendor.test',
            'is_approved'   => true,
            'is_active'     => true,
        ]);
    }

    private function makeQuote(ProcurementRequest $req, Vendor $vendor): ProcurementQuote
    {
        return $req->quotes()->create([
            'vendor_id'     => $vendor->id,
            'vendor_name'   => $vendor->name,
            'quoted_amount' => 42000,
            'currency'      => 'NAD',
            'quote_date'    => now(),
        ]);
    }

    public function test_assess_quote_without_coi_declaration_rejected(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $req    = $this->makeApprovedRequest($tenant, $staff->id);
        $quote  = $this->makeQuote($req, $this->makeVendor($tenant));

        [$http] = $this->asProcurementOfficer($tenant);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/quotes/{$quote->id}/assess", [
            'compliance_passed' => true,
            'compliance_notes'  => 'Meets requirements.',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['coi']);
    }

    public function test_assess_with_conflict_without_notes_rejected(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $req    = $this->makeApprovedRequest($tenant, $staff->id);
        $quote  = $this->makeQuote($req, $this->makeVendor($tenant));

        [$http, $officer] = $this->asProcurementOfficer($tenant);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/coi-declarations", [
            'context'      => 'assess',
            'has_conflict' => true,
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['notes']);

        $this->assertDatabaseMissing('procurement_coi_declarations', [
            'procurement_request_id' => $req->id,
            'user_id'                  => $officer->id,
            'context'                  => 'assess',
        ]);
    }

    public function test_assess_with_coi_declaration_succeeds(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $req    = $this->makeApprovedRequest($tenant, $staff->id);
        $quote  = $this->makeQuote($req, $this->makeVendor($tenant));

        [$http, $officer] = $this->asProcurementOfficer($tenant);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/coi-declarations", [
            'context'      => 'assess',
            'has_conflict' => false,
        ])->assertCreated();

        $http->postJson("/api/v1/procurement/requests/{$req->id}/quotes/{$quote->id}/assess", [
            'compliance_passed' => true,
            'compliance_notes'  => 'Meets requirements.',
        ])->assertOk()
          ->assertJsonPath('data.compliance_passed', true);

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'procurement.coi_declared',
        ]);
    }

    public function test_award_without_coi_declaration_rejected(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $vendor = $this->makeVendor($tenant);
        $req    = $this->makeApprovedRequest($tenant, $staff->id);
        $quote  = $this->makeQuote($req, $vendor);
        $quote->update([
            'compliance_passed' => true,
            'compliance_notes'  => 'OK',
            'assessed_by'       => $staff->id,
            'assessed_at'       => now(),
        ]);

        [$http] = $this->asProcurementOfficer($tenant);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/award", [
            'quote_id' => $quote->id,
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['coi']);
    }

    public function test_award_with_coi_declaration_succeeds(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $vendor = $this->makeVendor($tenant);
        $req    = $this->makeApprovedRequest($tenant, $staff->id);
        $quote  = $this->makeQuote($req, $vendor);
        $quote->update([
            'compliance_passed' => true,
            'compliance_notes'  => 'OK',
            'assessed_by'       => $staff->id,
            'assessed_at'       => now(),
        ]);

        [$http] = $this->asProcurementOfficer($tenant);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/coi-declarations", [
            'context'      => 'award',
            'has_conflict' => false,
        ])->assertCreated();

        $http->postJson("/api/v1/procurement/requests/{$req->id}/award", [
            'quote_id' => $quote->id,
        ])->assertOk()
          ->assertJsonPath('data.status', 'awarded');
    }
}
