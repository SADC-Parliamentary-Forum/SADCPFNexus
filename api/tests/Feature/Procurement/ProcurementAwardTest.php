<?php

namespace Tests\Feature\Procurement;

use App\Models\ProcurementQuote;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

class ProcurementAwardTest extends TestCase
{
    // ── Helpers ──────────────────────────────────────────────────────────────

    private function makeApprovedRequest(Tenant $tenant, int $requesterId): ProcurementRequest
    {
        return ProcurementRequest::create([
            'tenant_id'       => $tenant->id,
            'requester_id'    => $requesterId,
            'title'           => 'IT Equipment Purchase',
            'description'     => 'Laptops for programme staff',
            'category'        => 'goods',
            'estimated_value' => 45000,
            'currency'        => 'NAD',
            'status'          => 'approved',
            'submitted_at'    => now()->subDay(),
            'approved_at'     => now(),
            'rfq_issued_at'   => now()->subHours(12),
        ]);
    }

    private function makeApprovedVendor(Tenant $tenant): Vendor
    {
        return Vendor::create([
            'tenant_id'     => $tenant->id,
            'name'          => 'TechSupply Ltd',
            'contact_email' => 'orders@techsupply.com',
            'is_approved'   => true,
            'is_active'     => true,
        ]);
    }

    private function makeQuote(ProcurementRequest $req, Vendor $vendor, float $amount = 42000): ProcurementQuote
    {
        return $req->quotes()->create([
            'vendor_id'      => $vendor->id,
            'vendor_name'    => $vendor->name,
            'quoted_amount'  => $amount,
            'currency'       => 'NAD',
            'is_recommended' => true,
            'quote_date'     => now(),
            'compliance_passed' => true,
            'compliance_notes'  => 'Meets technical and commercial requirements.',
            'assessed_by'       => $req->requester_id,
            'assessed_at'       => now(),
        ]);
    }

    // ── Award ─────────────────────────────────────────────────────────────────

    public function test_procurement_officer_can_award_approved_request(): void
    {
        $tenant  = Tenant::factory()->create();
        $staff   = $this->makeUser('staff', $tenant);
        $vendor  = $this->makeApprovedVendor($tenant);
        $req     = $this->makeApprovedRequest($tenant, $staff->id);
        $quote   = $this->makeQuote($req, $vendor);

        [$http] = $this->asProcurementOfficer($tenant);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/award", [
            'quote_id'    => $quote->id,
            'award_notes' => 'Best value for money',
        ])->assertOk()
          ->assertJsonPath('data.status', 'awarded');

        $this->assertDatabaseHas('procurement_requests', [
            'id'               => $req->id,
            'status'           => 'awarded',
            'awarded_quote_id' => $quote->id,
        ]);
        $this->assertDatabaseHas('purchase_orders', [
            'tenant_id'              => $tenant->id,
            'procurement_request_id' => $req->id,
            'vendor_id'              => $vendor->id,
            'status'                 => 'draft',
        ]);
    }

    public function test_cannot_award_a_non_approved_request(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $vendor = $this->makeApprovedVendor($tenant);

        $req = ProcurementRequest::create([
            'tenant_id'       => $tenant->id,
            'requester_id'    => $staff->id,
            'title'           => 'Test Request',
            'description'     => 'Test',
            'category'        => 'goods',
            'estimated_value' => 10000,
            'currency'        => 'NAD',
            'status'          => 'submitted',
        ]);
        $quote = $this->makeQuote($req, $vendor);

        [$http] = $this->asProcurementOfficer($tenant);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/award", [
            'quote_id' => $quote->id,
        ])->assertUnprocessable();
    }

    public function test_cannot_award_without_selecting_a_quote(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $req    = $this->makeApprovedRequest($tenant, $staff->id);

        [$http] = $this->asProcurementOfficer($tenant);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/award", [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['quote_id']);
    }

    public function test_cannot_award_with_quote_from_different_request(): void
    {
        $tenant   = Tenant::factory()->create();
        $staff    = $this->makeUser('staff', $tenant);
        $vendor   = $this->makeApprovedVendor($tenant);
        $req      = $this->makeApprovedRequest($tenant, $staff->id);
        $otherReq = $this->makeApprovedRequest($tenant, $staff->id);
        $foreignQuote = $this->makeQuote($otherReq, $vendor);

        [$http] = $this->asProcurementOfficer($tenant);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/award", [
            'quote_id' => $foreignQuote->id,
        ])->assertUnprocessable();
    }

    public function test_only_procurement_officer_or_sg_can_award(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $vendor = $this->makeApprovedVendor($tenant);
        $req    = $this->makeApprovedRequest($tenant, $staff->id);
        $quote  = $this->makeQuote($req, $vendor);

        [$httpStaff] = $this->asStaff($tenant);

        $httpStaff->postJson("/api/v1/procurement/requests/{$req->id}/award", [
            'quote_id' => $quote->id,
        ])->assertForbidden();
    }

    public function test_award_sets_awarded_at_timestamp(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $vendor = $this->makeApprovedVendor($tenant);
        $req    = $this->makeApprovedRequest($tenant, $staff->id);
        $quote  = $this->makeQuote($req, $vendor);

        [$http] = $this->asProcurementOfficer($tenant);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/award", [
            'quote_id' => $quote->id,
        ])->assertOk();

        $this->assertNotNull(ProcurementRequest::find($req->id)->awarded_at);
    }

    public function test_audit_log_created_on_award(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $vendor = $this->makeApprovedVendor($tenant);
        $req    = $this->makeApprovedRequest($tenant, $staff->id);
        $quote  = $this->makeQuote($req, $vendor);

        [$http] = $this->asProcurementOfficer($tenant);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/award", [
            'quote_id' => $quote->id,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'event'          => 'procurement.awarded',
            'auditable_type' => ProcurementRequest::class,
            'auditable_id'   => $req->id,
        ]);
    }

    public function test_cross_tenant_cannot_award(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();

        $staff   = $this->makeUser('staff', $tenantA);
        $vendor  = $this->makeApprovedVendor($tenantA);
        $req     = $this->makeApprovedRequest($tenantA, $staff->id);
        $quote   = $this->makeQuote($req, $vendor);

        [$http] = $this->asProcurementOfficer($tenantB);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/award", [
            'quote_id' => $quote->id,
        ])->assertNotFound();
    }
}
