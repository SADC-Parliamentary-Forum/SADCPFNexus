<?php

namespace Tests\Feature\Procurement;

use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

class VendorPaginationTest extends TestCase
{
    public function test_vendor_index_returns_paginated_meta_and_page_size(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asProcurementOfficer($tenant);

        foreach (range(1, 5) as $i) {
            Vendor::create([
                'tenant_id'   => $tenant->id,
                'name'        => sprintf('Paged Vendor %02d', $i),
                'is_approved' => true,
                'is_active'   => true,
                'status'      => 'approved',
            ]);
        }

        $first = $http->getJson('/api/v1/procurement/vendors?per_page=2&page=1');
        $first->assertOk()
            ->assertJsonPath('total', 5)
            ->assertJsonPath('per_page', 2)
            ->assertJsonPath('current_page', 1)
            ->assertJsonPath('last_page', 3);
        $this->assertCount(2, $first->json('data'));

        $second = $http->getJson('/api/v1/procurement/vendors?per_page=2&page=2');
        $second->assertOk()
            ->assertJsonPath('current_page', 2);
        $this->assertCount(2, $second->json('data'));
        $this->assertNotEquals(
            $first->json('data.0.id'),
            $second->json('data.0.id')
        );
    }

    public function test_vendor_index_caps_per_page_at_one_hundred(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asProcurementOfficer($tenant);

        $http->getJson('/api/v1/procurement/vendors?per_page=500')
            ->assertOk()
            ->assertJsonPath('per_page', 100);
    }

    public function test_vendor_index_summary_is_tenant_wide_not_page_filtered(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asProcurementOfficer($tenant);

        Vendor::create([
            'tenant_id'   => $tenant->id,
            'name'        => 'Approved Co',
            'is_approved' => true,
            'is_active'   => true,
            'status'      => 'approved',
        ]);
        Vendor::create([
            'tenant_id'   => $tenant->id,
            'name'        => 'Pending Co',
            'is_approved' => false,
            'is_active'   => true,
            'status'      => 'pending_approval',
        ]);
        Vendor::create([
            'tenant_id'      => $tenant->id,
            'name'           => 'Blacklisted Co',
            'is_approved'    => false,
            'is_active'      => false,
            'status'         => 'blacklisted',
            'is_blacklisted' => true,
        ]);

        $http->getJson('/api/v1/procurement/vendors?status=pending')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('summary.approved', 1)
            ->assertJsonPath('summary.pending', 1)
            ->assertJsonPath('summary.blacklisted', 1);
    }
}
