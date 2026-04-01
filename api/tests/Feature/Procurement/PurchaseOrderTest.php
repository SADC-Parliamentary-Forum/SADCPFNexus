<?php

namespace Tests\Feature\Procurement;

use App\Models\ProcurementQuote;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

class PurchaseOrderTest extends TestCase
{
    // ── Helpers ──────────────────────────────────────────────────────────────

    private function makeAwardedRequest(Tenant $tenant, int $requesterId, int $vendorId, int $quoteId): ProcurementRequest
    {
        return ProcurementRequest::create([
            'tenant_id'        => $tenant->id,
            'requester_id'     => $requesterId,
            'title'            => 'IT Equipment',
            'description'      => 'Laptops for staff',
            'category'         => 'goods',
            'estimated_value'  => 45000,
            'currency'         => 'NAD',
            'status'           => 'awarded',
            'awarded_quote_id' => $quoteId,
            'awarded_at'       => now(),
        ]);
    }

    private function makeVendorAndQuote(Tenant $tenant, ProcurementRequest $req): array
    {
        $vendor = Vendor::create([
            'tenant_id'   => $tenant->id,
            'name'        => 'TechSupply Ltd',
            'is_approved' => true,
            'is_active'   => true,
        ]);
        $quote = $req->quotes()->create([
            'vendor_id'     => $vendor->id,
            'vendor_name'   => $vendor->name,
            'quoted_amount' => 43000,
            'currency'      => 'NAD',
        ]);
        return [$vendor, $quote];
    }

    private function poPayload(Vendor $vendor, ProcurementRequest $req, array $overrides = []): array
    {
        return array_merge([
            'procurement_request_id' => $req->id,
            'vendor_id'              => $vendor->id,
            'title'                  => 'PO for IT Equipment',
            'delivery_address'       => 'SADC-PF Offices, Windhoek',
            'payment_terms'          => 'net_30',
            'expected_delivery_date' => now()->addDays(14)->toDateString(),
            'items' => [
                ['description' => 'Laptop 15"', 'quantity' => 5, 'unit' => 'unit', 'unit_price' => 8600, 'total_price' => 43000],
            ],
        ], $overrides);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    public function test_procurement_officer_can_create_po_from_awarded_request(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $req    = ProcurementRequest::create([
            'tenant_id' => $tenant->id, 'requester_id' => $staff->id,
            'title' => 'IT Equipment', 'description' => 'Test', 'category' => 'goods', 'status' => 'awarded',
        ]);
        [$vendor, $quote] = $this->makeVendorAndQuote($tenant, $req);
        $req->update(['awarded_quote_id' => $quote->id]);

        [$http] = $this->asProcurementOfficer($tenant);

        $http->postJson('/api/v1/procurement/purchase-orders', $this->poPayload($vendor, $req))
             ->assertCreated()
             ->assertJsonPath('data.status', 'draft');

        $this->assertDatabaseHas('purchase_orders', [
            'tenant_id'              => $tenant->id,
            'procurement_request_id' => $req->id,
            'status'                 => 'draft',
        ]);
    }

    public function test_po_reference_number_auto_generated(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $req    = ProcurementRequest::create([
            'tenant_id' => $tenant->id, 'requester_id' => $staff->id,
            'title' => 'Test', 'description' => 'Test', 'category' => 'goods', 'status' => 'awarded',
        ]);
        [$vendor, $quote] = $this->makeVendorAndQuote($tenant, $req);
        $req->update(['awarded_quote_id' => $quote->id]);

        [$http] = $this->asProcurementOfficer($tenant);

        $response = $http->postJson('/api/v1/procurement/purchase-orders', $this->poPayload($vendor, $req));
        $response->assertCreated();
        $ref = $response->json('data.reference_number');
        $this->assertStringStartsWith('PO-', $ref);
    }

    public function test_po_cannot_be_created_from_non_awarded_request(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $req    = ProcurementRequest::create([
            'tenant_id' => $tenant->id, 'requester_id' => $staff->id,
            'title' => 'Test', 'description' => 'Test', 'category' => 'goods', 'status' => 'approved',
        ]);
        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'Vendor', 'is_approved' => true, 'is_active' => true]);

        [$http] = $this->asProcurementOfficer($tenant);

        $http->postJson('/api/v1/procurement/purchase-orders', $this->poPayload($vendor, $req))
             ->assertUnprocessable();
    }

    public function test_staff_cannot_create_po(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $http->postJson('/api/v1/procurement/purchase-orders', [])
             ->assertForbidden();
    }

    // ── Issue ─────────────────────────────────────────────────────────────────

    public function test_po_status_transitions_draft_to_issued(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $req    = ProcurementRequest::create([
            'tenant_id' => $tenant->id, 'requester_id' => $staff->id,
            'title' => 'Test', 'description' => 'Test', 'category' => 'goods', 'status' => 'awarded',
        ]);
        [$vendor, $quote] = $this->makeVendorAndQuote($tenant, $req);
        $req->update(['awarded_quote_id' => $quote->id]);

        [$http] = $this->asProcurementOfficer($tenant);
        $create = $http->postJson('/api/v1/procurement/purchase-orders', $this->poPayload($vendor, $req));
        $poId   = $create->json('data.id');

        $http->postJson("/api/v1/procurement/purchase-orders/{$poId}/issue")
             ->assertOk()
             ->assertJsonPath('data.status', 'issued');
    }

    public function test_only_finance_or_procurement_can_issue_po(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $req    = ProcurementRequest::create([
            'tenant_id' => $tenant->id, 'requester_id' => $staff->id,
            'title' => 'Test', 'description' => 'Test', 'category' => 'goods', 'status' => 'awarded',
        ]);
        [$vendor, $quote] = $this->makeVendorAndQuote($tenant, $req);
        $req->update(['awarded_quote_id' => $quote->id]);

        // Create PO as procurement officer
        [$procHttp] = $this->asProcurementOfficer($tenant);
        $create = $procHttp->postJson('/api/v1/procurement/purchase-orders', $this->poPayload($vendor, $req));
        $poId   = $create->json('data.id');

        // Staff cannot issue
        [$staffHttp] = $this->asStaff($tenant);
        $staffHttp->postJson("/api/v1/procurement/purchase-orders/{$poId}/issue")
                  ->assertForbidden();
    }

    // ── Cancel ────────────────────────────────────────────────────────────────

    public function test_po_can_be_cancelled_with_reason(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $req    = ProcurementRequest::create([
            'tenant_id' => $tenant->id, 'requester_id' => $staff->id,
            'title' => 'Test', 'description' => 'Test', 'category' => 'goods', 'status' => 'awarded',
        ]);
        [$vendor, $quote] = $this->makeVendorAndQuote($tenant, $req);
        $req->update(['awarded_quote_id' => $quote->id]);

        [$http] = $this->asProcurementOfficer($tenant);
        $create = $http->postJson('/api/v1/procurement/purchase-orders', $this->poPayload($vendor, $req));
        $poId   = $create->json('data.id');

        $http->postJson("/api/v1/procurement/purchase-orders/{$poId}/cancel", [
            'reason' => 'Vendor withdrew offer',
        ])->assertOk()
          ->assertJsonPath('data.status', 'cancelled');
    }

    // ── Tenant isolation ──────────────────────────────────────────────────────

    public function test_tenant_isolation_on_pos(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();

        $staff = $this->makeUser('staff', $tenantA);
        $req   = ProcurementRequest::create([
            'tenant_id' => $tenantA->id, 'requester_id' => $staff->id,
            'title' => 'Test', 'description' => 'Test', 'category' => 'goods', 'status' => 'awarded',
        ]);
        [$vendor, $quote] = $this->makeVendorAndQuote($tenantA, $req);
        $req->update(['awarded_quote_id' => $quote->id]);

        [$httpA] = $this->asProcurementOfficer($tenantA);
        $create = $httpA->postJson('/api/v1/procurement/purchase-orders', $this->poPayload($vendor, $req));
        $poId   = $create->json('data.id');

        [$httpB] = $this->asProcurementOfficer($tenantB);
        $httpB->getJson("/api/v1/procurement/purchase-orders/{$poId}")
              ->assertNotFound();
    }
}
