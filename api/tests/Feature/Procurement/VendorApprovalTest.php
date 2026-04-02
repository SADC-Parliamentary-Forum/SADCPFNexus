<?php

namespace Tests\Feature\Procurement;

use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

class VendorApprovalTest extends TestCase
{
    private function makePendingVendor(Tenant $tenant): Vendor
    {
        return Vendor::create([
            'tenant_id'     => $tenant->id,
            'name'          => 'Pending Supplier Co',
            'contact_email' => 'info@pendingsupplier.com',
            'is_approved'   => false,
            'is_active'     => true,
        ]);
    }

    public function test_procurement_officer_can_approve_vendor(): void
    {
        $tenant = Tenant::factory()->create();
        $vendor = $this->makePendingVendor($tenant);

        [$http] = $this->asProcurementOfficer($tenant);

        $http->postJson("/api/v1/procurement/vendors/{$vendor->id}/approve")
             ->assertOk()
             ->assertJsonPath('data.is_approved', true);

        $this->assertDatabaseHas('vendors', [
            'id'          => $vendor->id,
            'is_approved' => true,
        ]);
    }

    public function test_procurement_officer_can_reject_vendor_with_reason(): void
    {
        $tenant = Tenant::factory()->create();
        $vendor = $this->makePendingVendor($tenant);

        [$http] = $this->asProcurementOfficer($tenant);

        $http->postJson("/api/v1/procurement/vendors/{$vendor->id}/reject", [
            'reason' => 'Failed background check',
        ])->assertOk()
          ->assertJsonPath('data.is_approved', false)
          ->assertJsonPath('data.is_active', false);

        $this->assertDatabaseHas('vendors', [
            'id'               => $vendor->id,
            'is_approved'      => false,
            'is_active'        => false,
            'rejection_reason' => 'Failed background check',
        ]);
    }

    public function test_reject_vendor_requires_reason(): void
    {
        $tenant = Tenant::factory()->create();
        $vendor = $this->makePendingVendor($tenant);

        [$http] = $this->asProcurementOfficer($tenant);

        $http->postJson("/api/v1/procurement/vendors/{$vendor->id}/reject", [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['reason']);
    }

    public function test_staff_cannot_approve_vendor(): void
    {
        $tenant = Tenant::factory()->create();
        $vendor = $this->makePendingVendor($tenant);

        [$http] = $this->asStaff($tenant);

        $http->postJson("/api/v1/procurement/vendors/{$vendor->id}/approve")
             ->assertForbidden();
    }

    public function test_staff_cannot_reject_vendor(): void
    {
        $tenant = Tenant::factory()->create();
        $vendor = $this->makePendingVendor($tenant);

        [$http] = $this->asStaff($tenant);

        $http->postJson("/api/v1/procurement/vendors/{$vendor->id}/reject", [
            'reason' => 'Test',
        ])->assertForbidden();
    }

    public function test_vendor_approval_records_approved_by_and_timestamp(): void
    {
        $tenant = Tenant::factory()->create();
        $vendor = $this->makePendingVendor($tenant);

        [$http, $officer] = $this->asProcurementOfficer($tenant);

        $http->postJson("/api/v1/procurement/vendors/{$vendor->id}/approve")
             ->assertOk();

        $updated = Vendor::find($vendor->id);
        $this->assertEquals($officer->id, $updated->approved_by);
        $this->assertNotNull($updated->approved_at);
    }

    public function test_cross_tenant_cannot_approve_vendor(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();

        $vendor = $this->makePendingVendor($tenantA);

        [$http] = $this->asProcurementOfficer($tenantB);

        $http->postJson("/api/v1/procurement/vendors/{$vendor->id}/approve")
             ->assertNotFound();
    }
}
