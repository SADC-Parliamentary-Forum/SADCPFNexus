<?php

namespace Tests\Feature\Procurement;

use App\Models\ProcurementRequest;
use App\Models\Tenant;
use App\Models\Tender;
use Tests\TestCase;

class PublicNoticeBoardTest extends TestCase
{
    public function test_public_notices_list_published_tenders_without_bid_data(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);

        $req = ProcurementRequest::create([
            'tenant_id'          => $tenant->id,
            'requester_id'       => $officer->id,
            'title'              => 'Office Furniture',
            'description'        => 'Public tender',
            'category'           => 'goods',
            'estimated_value'    => 250_000,
            'currency'           => 'NAD',
            'status'             => 'approved',
            'procurement_method' => 'tender',
        ]);

        $published = Tender::create([
            'tenant_id'              => $tenant->id,
            'procurement_request_id' => $req->id,
            'reference_number'       => 'TND-PUB1',
            'title'                  => 'Office Furniture Tender',
            'notice'                 => 'SADC PF invites sealed bids for office furniture.',
            'status'                 => Tender::STATUS_PUBLISHED,
            'published_at'           => now(),
            'submission_deadline'    => now()->addDays(21)->toDateString(),
            'sealed_mode'            => true,
            'created_by'             => $officer->id,
        ]);

        $draftReq = ProcurementRequest::create([
            'tenant_id'          => $tenant->id,
            'requester_id'       => $officer->id,
            'title'              => 'Hidden Draft',
            'description'        => 'x',
            'category'           => 'goods',
            'estimated_value'    => 200_000,
            'currency'           => 'NAD',
            'status'             => 'approved',
            'procurement_method' => 'tender',
        ]);

        Tender::create([
            'tenant_id'              => $tenant->id,
            'procurement_request_id' => $draftReq->id,
            'reference_number'       => 'TND-DRAFT',
            'title'                  => 'Draft Only',
            'notice'                 => 'Should not appear',
            'status'                 => Tender::STATUS_DRAFT,
            'sealed_mode'            => true,
            'created_by'             => $officer->id,
        ]);

        $response = $this->getJson('/api/v1/procurement/notices')->assertOk();
        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertSame($published->reference_number, $data[0]['reference_number']);
        $this->assertSame('Office Furniture Tender', $data[0]['title']);
        $this->assertArrayHasKey('notice', $data[0]);
        $this->assertArrayNotHasKey('quotes', $data[0]);
        $this->assertArrayNotHasKey('quoted_amount', $data[0]);
        $this->assertArrayNotHasKey('procurement_request_id', $data[0]);
        $this->assertArrayNotHasKey('bids_opened_at', $data[0]);
    }

    public function test_staff_notice_board_requires_auth(): void
    {
        $this->getJson('/api/v1/procurement/notice-board')->assertUnauthorized();

        $tenant = Tenant::factory()->create();
        [$http] = $this->asProcurementOfficer($tenant);
        $http->getJson('/api/v1/procurement/notice-board')->assertOk();
    }
}
