<?php

namespace Tests\Feature\Procurement;

use App\Models\AnnualProcurementPlan;
use App\Models\Tenant;
use App\Models\Vendor;
use App\Models\VendorCatalogueItem;
use Tests\TestCase;

class PlanningAndCatalogueTest extends TestCase
{
    public function test_annual_plan_crud_with_items(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asProcurementOfficer($tenant);

        $created = $http->postJson('/api/v1/procurement/plans', [
            'plan_year' => 2026,
            'title'     => 'APP 2026',
            'items'     => [
                [
                    'description'      => 'Office furniture',
                    'estimated_value'  => 80_000,
                    'suggested_method' => 'quotation',
                    'quarter'          => 2,
                ],
            ],
        ])->assertCreated()
            ->assertJsonPath('data.plan_year', 2026);

        $planId = $created->json('data.id');

        $http->getJson('/api/v1/procurement/plans')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'APP 2026');

        $http->postJson("/api/v1/procurement/plans/{$planId}/items", [
            'description'     => 'Server hardware',
            'estimated_value' => 220_000,
            'suggested_method'=> 'tender',
            'quarter'         => 3,
        ])->assertCreated();

        $http->getJson("/api/v1/procurement/plans/{$planId}")
            ->assertOk()
            ->assertJsonCount(2, 'data.items');
    }

    public function test_catalogue_item_keeps_price_history(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asProcurementOfficer($tenant);
        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'Stationery Co', 'is_approved' => true, 'is_active' => true]);

        $created = $http->postJson('/api/v1/procurement/catalogue', [
            'vendor_id'  => $vendor->id,
            'item_name'  => 'A4 Paper Ream',
            'sku'        => 'PAP-A4',
            'unit'       => 'ream',
            'unit_price' => 85.50,
        ])->assertCreated();

        $itemId = $created->json('data.id');

        $http->putJson("/api/v1/procurement/catalogue/{$itemId}", [
            'unit_price'    => 92.00,
            'change_reason' => 'Supplier rate increase Q3',
        ])->assertOk();

        $this->assertEquals(92.0, (float) $http->getJson("/api/v1/procurement/catalogue/{$itemId}")->json('data.unit_price'));

        $http->getJson("/api/v1/procurement/catalogue/{$itemId}/history")
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->assertSame(1, VendorCatalogueItem::whereKey($itemId)->count());
        $this->assertSame(2, VendorCatalogueItem::find($itemId)->versions()->count());
    }

    public function test_duplicate_plan_year_rejected(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);

        AnnualProcurementPlan::create([
            'tenant_id'  => $tenant->id,
            'plan_year'  => 2026,
            'title'      => 'Existing',
            'created_by' => $officer->id,
        ]);

        $http->postJson('/api/v1/procurement/plans', [
            'plan_year' => 2026,
            'title'     => 'Duplicate',
        ])->assertUnprocessable();
    }
}
