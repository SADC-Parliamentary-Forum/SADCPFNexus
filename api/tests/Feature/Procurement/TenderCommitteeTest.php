<?php

namespace Tests\Feature\Procurement;

use App\Models\Tenant;
use App\Models\TenderCommittee;
use App\Models\User;
use Tests\TestCase;

class TenderCommitteeTest extends TestCase
{
    public function test_create_committee_with_members_and_quorum_on_meeting(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);

        $m1 = $this->makeUser('Finance Controller', $tenant);
        $m2 = $this->makeUser('HOD', $tenant);
        $m3 = $this->makeUser('staff', $tenant);

        $create = $http->postJson('/api/v1/procurement/tender-committees', [
            'name'            => 'Standing Tender Committee 2026',
            'code'            => 'STC-2026',
            'quorum_minimum'  => 3,
            'members'         => [
                ['user_id' => $m1->id, 'role' => 'chair'],
                ['user_id' => $m2->id, 'role' => 'member'],
                ['user_id' => $m3->id, 'role' => 'secretary'],
            ],
        ])->assertCreated();

        $committeeId = $create->json('data.id');
        $this->assertSame(3, count($create->json('data.members')));

        $http->postJson("/api/v1/procurement/tender-committees/{$committeeId}/meetings", [
            'title'           => 'Bid opening meeting',
            'held_at'         => now()->toIso8601String(),
            'members_present' => 2,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['quorum']);

        $http->postJson("/api/v1/procurement/tender-committees/{$committeeId}/meetings", [
            'title'           => 'Bid opening meeting',
            'held_at'         => now()->toIso8601String(),
            'members_present' => 3,
            'minutes_url'     => 'https://example.com/minutes/1',
        ])->assertCreated()
            ->assertJsonPath('data.quorum_met', true);
    }

    public function test_list_committees_scoped_to_tenant(): void
    {
        $tenant = Tenant::factory()->create();
        $other = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);

        TenderCommittee::create([
            'tenant_id'  => $tenant->id,
            'name'       => 'Ours',
            'created_by' => $officer->id,
        ]);
        $otherOfficer = User::factory()->create(['tenant_id' => $other->id]);
        TenderCommittee::create([
            'tenant_id'  => $other->id,
            'name'       => 'Theirs',
            'created_by' => $otherOfficer->id,
        ]);

        $http->getJson('/api/v1/procurement/tender-committees')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Ours');
    }
}
