<?php

namespace Tests\Feature\Procurement;

use App\Models\ProcurementQuote;
use App\Models\ProcurementRequest;
use App\Models\RfqInvitation;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SealedBidBehaviourTest extends TestCase
{
    private function makeTenderWithQuote(Tenant $tenant, User $officer, Vendor $vendor): array
    {
        $req = ProcurementRequest::create([
            'tenant_id'          => $tenant->id,
            'requester_id'       => $officer->id,
            'title'              => 'Open Tender Goods',
            'description'        => 'Sealed bid tender',
            'category'           => 'goods',
            'estimated_value'    => 250_000,
            'currency'           => 'NAD',
            'status'             => 'approved',
            'procurement_method' => 'tender',
            'rfq_deadline'       => now()->addDays(7)->toDateString(),
        ]);

        $tender = Tender::create([
            'tenant_id'              => $tenant->id,
            'procurement_request_id' => $req->id,
            'reference_number'       => 'TND-' . strtoupper(\Illuminate\Support\Str::random(6)),
            'title'                  => $req->title,
            'status'                 => 'published',
            'sealed_mode'            => true,
            'published_at'           => now(),
            'submission_deadline'    => now()->addDays(7)->toDateString(),
            'created_by'             => $officer->id,
        ]);

        $quote = ProcurementQuote::create([
            'procurement_request_id' => $req->id,
            'vendor_id'              => $vendor->id,
            'vendor_name'            => $vendor->name,
            'quoted_amount'          => 210_000,
            'currency'               => 'NAD',
            'submission_channel'     => 'system_portal',
            'version'                => 1,
            'is_current'             => true,
            'quote_date'             => now()->toDateString(),
        ]);

        return [$req, $tender, $quote];
    }

    public function test_financials_hidden_before_bid_opening(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'Bidder A', 'is_approved' => true, 'is_active' => true]);

        [$req] = $this->makeTenderWithQuote($tenant, $officer, $vendor);

        $response = $http->getJson("/api/v1/procurement/requests/{$req->id}/quotes")
            ->assertOk();

        $row = $response->json('data.0');
        $this->assertArrayNotHasKey('quoted_amount', $row);
        $this->assertTrue($row['financials_sealed'] ?? false);
        $this->assertSame($vendor->name, $row['vendor_name']);
    }

    public function test_financials_visible_after_open_bids(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'Bidder B', 'is_approved' => true, 'is_active' => true]);

        [$req, $tender] = $this->makeTenderWithQuote($tenant, $officer, $vendor);

        $http->postJson("/api/v1/procurement/tenders/{$tender->id}/close")->assertOk();
        $http->postJson("/api/v1/procurement/tenders/{$tender->id}/open-bids")->assertOk();

        $response = $http->getJson("/api/v1/procurement/requests/{$req->id}/quotes")
            ->assertOk();

        $this->assertEquals(210_000, $response->json('data.0.quoted_amount'));
        $this->assertFalse($response->json('data.0.financials_sealed'));
    }

    public function test_supplier_can_version_replace_before_deadline_and_lock_after(): void
    {
        $tenant = Tenant::factory()->create();
        $officer = $this->makeProcurementOfficer($tenant);
        $vendor = Vendor::create([
            'tenant_id'   => $tenant->id,
            'name'        => 'Portal Bidder',
            'is_approved' => true,
            'is_active'   => true,
            'status'      => 'approved',
        ]);

        $portalUser = User::factory()->create([
            'tenant_id' => $tenant->id,
            'vendor_id' => $vendor->id,
            'email'     => 'bidder@example.com',
            'password'  => Hash::make('password'),
        ]);
        $portalUser->assignRole('Supplier');

        $req = ProcurementRequest::create([
            'tenant_id'          => $tenant->id,
            'requester_id'       => $officer->id,
            'title'              => 'Portal Tender',
            'description'        => 'Sealed',
            'category'           => 'goods',
            'estimated_value'    => 200_000,
            'currency'           => 'NAD',
            'status'             => 'approved',
            'procurement_method' => 'tender',
            'rfq_issued_at'      => now(),
            'rfq_deadline'       => now()->addDays(5)->toDateString(),
        ]);

        Tender::create([
            'tenant_id'              => $tenant->id,
            'procurement_request_id' => $req->id,
            'reference_number'       => 'TND-PORTAL1',
            'title'                  => $req->title,
            'status'                 => 'published',
            'sealed_mode'            => true,
            'published_at'           => now(),
            'submission_deadline'    => now()->addDays(5)->toDateString(),
            'created_by'             => $officer->id,
        ]);

        RfqInvitation::create([
            'tenant_id'              => $tenant->id,
            'procurement_request_id' => $req->id,
            'vendor_id'              => $vendor->id,
            'invited_at'             => now(),
            'status'                 => 'invited',
        ]);

        $this->asUser($portalUser)
            ->postJson("/api/v1/procurement/supplier/rfqs/{$req->id}/quote", [
                'quoted_amount' => 180_000,
            ])->assertCreated()
            ->assertJsonPath('data.version', 1);

        $replace = $this->asUser($portalUser)
            ->postJson("/api/v1/procurement/supplier/rfqs/{$req->id}/quote", [
                'quoted_amount' => 175_000,
            ])->assertCreated()
            ->assertJsonPath('data.version', 2);

        $this->assertEquals(175000, (float) $replace->json('data.quoted_amount'));

        $this->assertSame(1, ProcurementQuote::where('procurement_request_id', $req->id)->where('is_current', true)->count());
        $this->assertSame(2, ProcurementQuote::where('procurement_request_id', $req->id)->count());

        $req->update(['rfq_deadline' => now()->subDay()->toDateString()]);
        Tender::where('procurement_request_id', $req->id)->update([
            'submission_deadline' => now()->subDay()->toDateString(),
            'status'              => 'closed',
            'closed_at'           => now(),
        ]);

        $this->asUser($portalUser)
            ->postJson("/api/v1/procurement/supplier/rfqs/{$req->id}/quote", [
                'quoted_amount' => 170_000,
            ])->assertStatus(422);
    }
}
