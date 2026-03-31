<?php

namespace Tests\Feature\Procurement;

use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

class VendorsTest extends TestCase
{
    private function vendorPayload(array $overrides = []): array
    {
        return array_merge([
            'name'         => 'Acme Supplies (Pty) Ltd',
            'contact_name' => 'John Smith',
            'email'        => 'john@acme.co.na',
            'phone'        => '+264 61 123456',
            'address'      => '12 Independence Ave, Windhoek',
            'category'     => 'goods',
        ], $overrides);
    }

    // ── Auth ─────────────────────────────────────────────────────────────────

    public function test_unauthenticated_cannot_list_vendors(): void
    {
        $this->getJson('/api/v1/procurement/vendors')->assertUnauthorized();
    }

    // ── List ─────────────────────────────────────────────────────────────────

    public function test_authenticated_user_can_list_vendors(): void
    {
        [$http] = $this->asStaff();

        $response = $http->getJson('/api/v1/procurement/vendors');
        $response->assertOk()
                 ->assertJsonStructure(['data']);
    }

    // ── Create ───────────────────────────────────────────────────────────────

    public function test_procurement_officer_can_create_vendor(): void
    {
        [$http] = $this->asProcurementOfficer();

        $response = $http->postJson('/api/v1/procurement/vendors', $this->vendorPayload());

        $response->assertCreated()
                 ->assertJsonPath('data.name', 'Acme Supplies (Pty) Ltd')
                 ->assertJsonPath('data.email', 'john@acme.co.na');

        $this->assertDatabaseHas('vendors', ['name' => 'Acme Supplies (Pty) Ltd']);
    }

    public function test_create_vendor_requires_name(): void
    {
        [$http] = $this->asProcurementOfficer();

        $http->postJson('/api/v1/procurement/vendors', [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['name']);
    }

    public function test_staff_cannot_create_vendor(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/procurement/vendors', $this->vendorPayload())
             ->assertForbidden();
    }

    // ── Show ─────────────────────────────────────────────────────────────────

    public function test_procurement_officer_can_show_vendor(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asProcurementOfficer($tenant);

        $create = $http->postJson('/api/v1/procurement/vendors', $this->vendorPayload());
        $id = $create->json('data.id');

        $http->getJson("/api/v1/procurement/vendors/{$id}")
             ->assertOk()
             ->assertJsonPath('data.id', $id);
    }

    // ── Update ───────────────────────────────────────────────────────────────

    public function test_procurement_officer_can_update_vendor(): void
    {
        [$http] = $this->asProcurementOfficer();

        $create = $http->postJson('/api/v1/procurement/vendors', $this->vendorPayload());
        $id = $create->json('data.id');

        $http->putJson("/api/v1/procurement/vendors/{$id}", $this->vendorPayload([
            'name'         => 'Updated Vendor Name',
            'contact_name' => 'Jane Doe',
        ]))->assertOk()
           ->assertJsonPath('data.name', 'Updated Vendor Name');

        $this->assertDatabaseHas('vendors', ['id' => $id, 'name' => 'Updated Vendor Name']);
    }

    // ── Delete ───────────────────────────────────────────────────────────────

    public function test_procurement_officer_can_delete_vendor(): void
    {
        [$http] = $this->asProcurementOfficer();

        $create = $http->postJson('/api/v1/procurement/vendors', $this->vendorPayload());
        $id = $create->json('data.id');

        $http->deleteJson("/api/v1/procurement/vendors/{$id}")
             ->assertOk();

        $this->assertDatabaseMissing('vendors', ['id' => $id]);
    }

    // ── 404 ─────────────────────────────────────────────────────────────────

    public function test_returns_404_for_nonexistent_vendor(): void
    {
        [$http] = $this->asProcurementOfficer();

        $http->getJson('/api/v1/procurement/vendors/99999')
             ->assertNotFound();
    }

    // ── Tenant isolation ─────────────────────────────────────────────────────

    public function test_vendor_is_scoped_to_tenant(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();

        [$httpA] = $this->asProcurementOfficer($tenantA);
        $createA = $httpA->postJson('/api/v1/procurement/vendors', $this->vendorPayload());
        $idA = $createA->json('data.id');

        [$httpB] = $this->asProcurementOfficer($tenantB);
        $httpB->getJson("/api/v1/procurement/vendors/{$idA}")
              ->assertNotFound();
    }
}
