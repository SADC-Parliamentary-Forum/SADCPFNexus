<?php

namespace Tests\Feature\Security;

use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

class VendorAttachmentAuthorizationTest extends TestCase
{
    public function test_staff_cannot_list_vendor_attachments(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $vendor = Vendor::create([
            'tenant_id'   => $tenant->id,
            'name'        => 'Acme Supplies',
            'is_approved' => true,
            'is_active'   => true,
        ]);

        $this->asUser($staff)
            ->getJson("/api/v1/procurement/vendors/{$vendor->id}/attachments")
            ->assertForbidden();
    }

    public function test_procurement_officer_can_list_vendor_attachments(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asProcurementOfficer($tenant);
        $vendor = Vendor::create([
            'tenant_id'   => $tenant->id,
            'name'        => 'Acme Supplies',
            'is_approved' => true,
            'is_active'   => true,
        ]);

        $http->getJson("/api/v1/procurement/vendors/{$vendor->id}/attachments")
            ->assertOk();
    }
}
