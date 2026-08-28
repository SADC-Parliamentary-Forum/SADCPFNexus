<?php

namespace Tests\Feature\Security;

use App\Models\ImprestRequest;
use App\Models\LeaveRequest;
use App\Models\ProcurementRequest;
use App\Models\Tenant;
use App\Models\TravelRequest;
use Tests\TestCase;

/**
 * Negative authz (BOLA) for request show/mutate after AuthorizesRequestRecords.
 */
class RequestBolaAuthorizationTest extends TestCase
{
    /**
     * Out-of-scope records may 403 or 404; both deny access. 404 is preferred
     * because it does not confirm the record exists.
     */
    private function assertDenied(\Illuminate\Testing\TestResponse $response): void
    {
        $this->assertContains($response->status(), [403, 404], 'Expected BOLA denial (403 or 404), got '.$response->status());
    }

    public function test_peer_cannot_view_another_users_travel_request(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);
        $peer = $this->makeUser('staff', $tenant);

        $travel = TravelRequest::create([
            'tenant_id'            => $tenant->id,
            'requester_id'         => $owner->id,
            'reference_number'     => 'TRV-BOLA-001',
            'purpose'              => 'Confidential mission',
            'departure_date'       => now()->addDays(10)->toDateString(),
            'return_date'          => now()->addDays(12)->toDateString(),
            'destination_country'  => 'Zambia',
            'status'               => 'draft',
        ]);

        $this->assertDenied(
            $this->asUser($peer)->getJson("/api/v1/travel/requests/{$travel->id}")
        );
    }

    public function test_owner_can_view_own_travel_request(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $owner] = $this->asStaff($tenant);

        $travel = TravelRequest::create([
            'tenant_id'            => $tenant->id,
            'requester_id'         => $owner->id,
            'reference_number'     => 'TRV-BOLA-OWN',
            'purpose'              => 'Own mission',
            'departure_date'       => now()->addDays(10)->toDateString(),
            'return_date'          => now()->addDays(12)->toDateString(),
            'destination_country'  => 'Namibia',
            'status'               => 'draft',
        ]);

        $http->getJson("/api/v1/travel/requests/{$travel->id}")->assertOk();
    }

    public function test_peer_cannot_view_another_users_leave_request(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);
        $peer = $this->makeUser('staff', $tenant);

        $leave = LeaveRequest::create([
            'tenant_id'        => $tenant->id,
            'requester_id'     => $owner->id,
            'reference_number' => 'LV-BOLA-SHOW',
            'leave_type'       => 'annual',
            'start_date'       => now()->addDays(5)->toDateString(),
            'end_date'         => now()->addDays(6)->toDateString(),
            'days_requested'   => 2,
            'reason'           => 'Private leave',
            'status'           => 'draft',
        ]);

        $this->assertDenied(
            $this->asUser($peer)->getJson("/api/v1/leave/requests/{$leave->id}")
        );
    }

    public function test_peer_cannot_update_another_users_leave_request(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);
        $peer = $this->makeUser('staff', $tenant);

        $leave = LeaveRequest::create([
            'tenant_id'        => $tenant->id,
            'requester_id'     => $owner->id,
            'reference_number' => 'LV-BOLA-001',
            'leave_type'       => 'annual',
            'start_date'       => now()->addDays(5)->toDateString(),
            'end_date'         => now()->addDays(6)->toDateString(),
            'days_requested'   => 2,
            'reason'           => 'Private',
            'status'           => 'draft',
        ]);

        $this->assertDenied(
            $this->asUser($peer)->putJson("/api/v1/leave/requests/{$leave->id}", [
                'reason' => 'Hacked',
            ])
        );
    }

    public function test_peer_cannot_view_another_users_imprest_request(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);
        $peer = $this->makeUser('staff', $tenant);

        $imprest = ImprestRequest::create([
            'tenant_id'         => $tenant->id,
            'requester_id'      => $owner->id,
            'reference_number'  => 'IMP-BOLA-001',
            'purpose'           => 'Sensitive imprest',
            'budget_line'               => 'OPS-001',
            'amount_requested'          => 500,
            'currency'                  => 'NAD',
            'expected_liquidation_date' => now()->addDays(30)->toDateString(),
            'status'                    => 'draft',
        ]);

        $this->assertDenied(
            $this->asUser($peer)->getJson("/api/v1/imprest/requests/{$imprest->id}")
        );
    }

    public function test_peer_cannot_view_another_users_procurement_request(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);
        $peer = $this->makeUser('staff', $tenant);

        $procurement = ProcurementRequest::create([
            'tenant_id'        => $tenant->id,
            'requester_id'     => $owner->id,
            'reference_number' => 'PRC-BOLA-001',
            'title'            => 'Sensitive purchase',
            'description'      => 'Confidential',
            'category'         => 'goods',
            'estimated_value'  => 1000,
            'currency'         => 'NAD',
            'status'           => 'draft',
        ]);

        $this->assertDenied(
            $this->asUser($peer)->getJson("/api/v1/procurement/requests/{$procurement->id}")
        );
    }

    public function test_guest_cannot_view_travel_request(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);

        $travel = TravelRequest::create([
            'tenant_id'            => $tenant->id,
            'requester_id'         => $owner->id,
            'reference_number'     => 'TRV-BOLA-GUEST',
            'purpose'              => 'Mission',
            'departure_date'       => now()->addDays(10)->toDateString(),
            'return_date'          => now()->addDays(12)->toDateString(),
            'destination_country'  => 'Botswana',
            'status'               => 'draft',
        ]);

        $this->getJson("/api/v1/travel/requests/{$travel->id}")
            ->assertUnauthorized();
    }
}
