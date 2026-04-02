<?php

namespace Tests\Feature\Procurement;

use App\Models\ProcurementRequest;
use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

class AnalyticsTest extends TestCase
{
    public function test_analytics_summary_accessible_by_procurement_officer(): void
    {
        $tenant = Tenant::factory()->create();
        [$http]  = $this->asProcurementOfficer($tenant);

        $http->getJson('/api/v1/procurement/analytics/summary')
            ->assertOk()
            ->assertJsonStructure(['data' => ['total_requests', 'total_spend', 'avg_cycle_time_days', 'active_contracts']]);
    }

    public function test_analytics_spend_by_category(): void
    {
        $tenant = Tenant::factory()->create();
        [$http]  = $this->asProcurementOfficer($tenant);

        $http->getJson('/api/v1/procurement/analytics/spend-by-category')
            ->assertOk()
            ->assertJsonStructure(['data']);
    }

    public function test_analytics_vendor_performance(): void
    {
        $tenant = Tenant::factory()->create();
        [$http]  = $this->asProcurementOfficer($tenant);

        $http->getJson('/api/v1/procurement/analytics/vendor-performance')
            ->assertOk()
            ->assertJsonStructure(['data']);
    }

    public function test_analytics_flags_accessible(): void
    {
        $tenant = Tenant::factory()->create();
        [$http]  = $this->asProcurementOfficer($tenant);

        $http->getJson('/api/v1/procurement/analytics/flags')
            ->assertOk()
            ->assertJsonStructure(['data']);
    }

    public function test_staff_cannot_access_analytics(): void
    {
        $tenant = Tenant::factory()->create();
        [$http]  = $this->asStaff($tenant);

        $http->getJson('/api/v1/procurement/analytics/summary')->assertForbidden();
    }

    public function test_analytics_detects_repeated_vendor_awards(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asProcurementOfficer($tenant);

        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'Dominant Supplier', 'is_approved' => true, 'is_active' => true]);

        // Create 4 awarded requests for the same vendor (each with a linked quote)
        foreach (range(1, 4) as $i) {
            $req = ProcurementRequest::create([
                'tenant_id'       => $tenant->id,
                'requester_id'    => $user->id,
                'title'           => "Request $i",
                'description'     => 'Test',
                'category'        => 'goods',
                'estimated_value' => 10000,
                'currency'        => 'NAD',
                'status'          => 'awarded',
                'awarded_at'      => now()->subMonths($i),
            ]);
            $quote = $req->quotes()->create([
                'vendor_id'     => $vendor->id,
                'vendor_name'   => $vendor->name,
                'quoted_amount' => 10000,
                'currency'      => 'NAD',
            ]);
            $req->update(['awarded_quote_id' => $quote->id]);
        }

        $response = $http->getJson('/api/v1/procurement/analytics/flags')->assertOk();
        $flags = $response->json('data');
        // repeated_award flag should fire for vendor awarded 4 times
        $this->assertNotEmpty($flags);
        $types = array_column($flags, 'type');
        $this->assertContains('repeated_award', $types);
    }
}
