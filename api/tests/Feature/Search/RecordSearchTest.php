<?php

namespace Tests\Feature\Search;

use App\Models\Tenant;
use App\Models\TravelRequest;
use App\Models\User;
use App\Models\Vendor;
use Tests\TestCase;

/**
 * GET /search/records only returns records the caller can open in their own
 * module, and treats user input as text (no LIKE wildcards).
 */
class RecordSearchTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
    }

    private function travelRecord(User $requester, string $reference, string $purpose, ?Tenant $tenant = null): TravelRequest
    {
        return TravelRequest::create([
            'tenant_id' => ($tenant ?? $this->tenant)->id, 'requester_id' => $requester->id, 'reference_number' => $reference,
            'destination_country' => 'Namibia', 'destination_city' => 'Windhoek', 'purpose' => $purpose,
            'departure_date' => now()->addDays(3)->toDateString(), 'return_date' => now()->addDays(5)->toDateString(),
            'currency' => 'NAD', 'status' => 'draft',
        ]);
    }

    private function search(User $user, string $q): array
    {
        return $this->actingAs($user, 'sanctum')->getJson('/api/v1/search/records?q='.urlencode($q))->assertOk()->json('data');
    }

    public function test_finds_my_own_request_by_reference_but_not_a_colleagues(): void
    {
        $me = $this->makeUser('staff', $this->tenant);
        $colleague = $this->makeUser('staff', $this->tenant);
        $mine = $this->travelRecord($me, 'TRV-SRCH-0001', 'Budget workshop');
        $this->travelRecord($colleague, 'TRV-SRCH-0002', 'Budget workshop (colleague)');

        $results = collect($this->search($me, 'TRV-SRCH'));

        $this->assertSame([$mine->id], $results->where('module', 'travel')->pluck('id')->values()->all());
        $this->assertSame('/travel/'.$mine->id, $results->firstWhere('id', $mine->id)['path']);
    }

    public function test_never_returns_another_tenants_records(): void
    {
        $outsider = $this->makeAdmin(Tenant::factory()->create());
        $this->travelRecord($this->makeUser('staff', $this->tenant), 'TRV-SRCH-XT01', 'Cross tenant');

        $this->assertSame([], $this->search($outsider, 'TRV-SRCH-XT'));
    }

    public function test_suppliers_are_only_searchable_with_vendor_register_access(): void
    {
        Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'Kalahari Supplies '.uniqid(), 'is_approved' => true, 'is_active' => true]);

        $staff = $this->makeUser('staff', $this->tenant);
        $officer = $this->makeProcurementOfficer($this->tenant);

        $this->assertSame([], collect($this->search($staff, 'Kalahari'))->where('module', 'suppliers')->values()->all());
        $this->assertNotEmpty(collect($this->search($officer, 'Kalahari'))->where('module', 'suppliers')->all());
    }

    public function test_like_wildcards_in_the_query_are_literal(): void
    {
        $me = $this->makeUser('staff', $this->tenant);
        $this->travelRecord($me, 'TRV-SRCH-0003', 'Ordinary trip');

        $this->assertSame([], $this->search($me, '%_'));
    }

    public function test_query_must_be_at_least_two_characters(): void
    {
        $this->actingAs($this->makeUser('staff', $this->tenant), 'sanctum')
            ->getJson('/api/v1/search/records?q=a')
            ->assertStatus(422);
    }
}
