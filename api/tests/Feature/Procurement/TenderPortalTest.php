<?php

namespace Tests\Feature\Procurement;

use App\Models\ProcurementRequest;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\TenderCommittee;
use Tests\TestCase;

class TenderPortalTest extends TestCase
{
    public function test_tender_lifecycle_publish_close_open_evaluate(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);

        $req = ProcurementRequest::create([
            'tenant_id'          => $tenant->id,
            'requester_id'       => $officer->id,
            'title'              => 'Fleet Vehicles',
            'description'        => 'Open tender',
            'category'           => 'goods',
            'estimated_value'    => 500_000,
            'currency'           => 'NAD',
            'status'             => 'approved',
            'procurement_method' => 'tender',
        ]);

        $committee = TenderCommittee::create([
            'tenant_id'      => $tenant->id,
            'name'           => 'Eval Committee',
            'quorum_minimum' => 3,
            'created_by'     => $officer->id,
        ]);

        $created = $http->postJson('/api/v1/procurement/tenders', [
            'procurement_request_id' => $req->id,
            'title'                  => 'Fleet Vehicles Tender',
            'notice'                 => 'SADC PF invites sealed bids.',
            'tender_committee_id'    => $committee->id,
            'submission_deadline'    => now()->addDays(14)->toDateString(),
            'sealed_mode'            => true,
        ])->assertCreated()
            ->assertJsonPath('data.status', 'draft');

        $tenderId = $created->json('data.id');

        $http->postJson("/api/v1/procurement/tenders/{$tenderId}/publish")
            ->assertOk()
            ->assertJsonPath('data.status', 'published');

        $http->postJson("/api/v1/procurement/tenders/{$tenderId}/close")
            ->assertOk()
            ->assertJsonPath('data.status', 'closed');

        $http->postJson("/api/v1/procurement/tenders/{$tenderId}/open-bids")
            ->assertOk()
            ->assertJsonPath('data.status', 'opened');

        $http->postJson("/api/v1/procurement/tenders/{$tenderId}/start-evaluation")
            ->assertOk()
            ->assertJsonPath('data.status', 'evaluating');

        $http->getJson('/api/v1/procurement/tenders')
            ->assertOk()
            ->assertJsonPath('data.0.id', $tenderId);

        $http->getJson('/api/v1/procurement/evaluations')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $http->getJson('/api/v1/procurement/bid-submissions')
            ->assertOk();
    }

    public function test_cannot_create_second_tender_for_same_request(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);

        $req = ProcurementRequest::create([
            'tenant_id'          => $tenant->id,
            'requester_id'       => $officer->id,
            'title'              => 'Dup Tender',
            'description'        => 'x',
            'category'           => 'goods',
            'estimated_value'    => 200_000,
            'currency'           => 'NAD',
            'status'             => 'approved',
            'procurement_method' => 'tender',
        ]);

        Tender::create([
            'tenant_id'              => $tenant->id,
            'procurement_request_id' => $req->id,
            'reference_number'       => 'TND-DUP1',
            'title'                  => 'Existing',
            'status'                 => 'draft',
            'created_by'             => $officer->id,
        ]);

        $http->postJson('/api/v1/procurement/tenders', [
            'procurement_request_id' => $req->id,
            'title'                  => 'Second',
            'submission_deadline'    => now()->addDays(7)->toDateString(),
        ])->assertUnprocessable();
    }
}
