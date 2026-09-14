<?php

namespace Tests\Feature\Security;

use App\Models\Attachment;
use App\Models\Tenant;
use App\Models\User;
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

    public function test_procurement_view_permission_can_list_vendor_attachments(): void
    {
        $tenant = Tenant::factory()->create();
        $viewer = $this->makeUser('staff', $tenant);
        $viewer->givePermissionTo('procurement.view');
        $vendor = Vendor::create([
            'tenant_id'   => $tenant->id,
            'name'        => 'Viewable Supplies',
            'is_approved' => true,
            'is_active'   => true,
        ]);

        $this->asUser($viewer)
            ->getJson("/api/v1/procurement/vendors/{$vendor->id}/attachments")
            ->assertOk();
    }

    public function test_procurement_view_permission_cannot_delete_vendor_attachments(): void
    {
        $tenant = Tenant::factory()->create();
        $viewer = $this->makeUser('staff', $tenant);
        $viewer->givePermissionTo('procurement.view');
        $vendor = Vendor::create([
            'tenant_id'   => $tenant->id,
            'name'        => 'View Only Supplies',
            'is_approved' => true,
            'is_active'   => true,
        ]);
        $attachment = $vendor->attachments()->create([
            'tenant_id'         => $tenant->id,
            'uploaded_by'       => $viewer->id,
            'document_type'     => Attachment::DOCUMENT_TYPE_COMPANY_PROFILE,
            'original_filename' => 'profile.pdf',
            'storage_path'      => 'attachments/vendors/'.$vendor->id.'/profile.pdf',
            'mime_type'         => 'application/pdf',
            'size_bytes'        => 100,
        ]);

        $this->asUser($viewer)
            ->deleteJson("/api/v1/procurement/vendors/{$vendor->id}/attachments/{$attachment->id}")
            ->assertForbidden();
    }

    public function test_supplier_can_list_own_attachments_but_cannot_delete_them(): void
    {
        $tenant = Tenant::factory()->create();
        $vendor = Vendor::create([
            'tenant_id'   => $tenant->id,
            'name'        => 'Own Docs Supplies',
            'is_approved' => true,
            'is_active'   => true,
        ]);
        $supplier = User::factory()->create([
            'tenant_id' => $tenant->id,
            'vendor_id' => $vendor->id,
        ]);
        $supplier->assignRole('Supplier');
        $attachment = $vendor->attachments()->create([
            'tenant_id'         => $tenant->id,
            'uploaded_by'       => $supplier->id,
            'document_type'     => Attachment::DOCUMENT_TYPE_COMPANY_PROFILE,
            'original_filename' => 'reg.pdf',
            'storage_path'      => 'attachments/vendors/'.$vendor->id.'/reg.pdf',
            'mime_type'         => 'application/pdf',
            'size_bytes'        => 100,
        ]);

        $this->asUser($supplier)
            ->getJson("/api/v1/procurement/vendors/{$vendor->id}/attachments")
            ->assertOk()
            ->assertJsonFragment(['original_filename' => 'reg.pdf']);

        $this->asUser($supplier)
            ->deleteJson("/api/v1/procurement/vendors/{$vendor->id}/attachments/{$attachment->id}")
            ->assertForbidden();
    }
}
