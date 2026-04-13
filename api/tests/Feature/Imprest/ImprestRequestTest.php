<?php

namespace Tests\Feature\Imprest;

use App\Models\ImprestRequest;
use App\Models\Tenant;
use Tests\TestCase;

class ImprestRequestTest extends TestCase
{
    private function imprestPayload(array $overrides = []): array
    {
        return array_merge([
            'budget_line'               => 'Programme 1 — Activities',
            'amount_requested'          => 1500.00,
            'currency'                  => 'NAD',
            'expected_liquidation_date' => now()->addDays(30)->toDateString(),
            'purpose'                   => 'Procure stationery for workshop',
        ], $overrides);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson('/api/v1/imprest/requests')->assertUnauthorized();
    }

    public function test_staff_can_create_an_imprest_request(): void
    {
        [$http, $user] = $this->asStaff();

        $response = $http->postJson('/api/v1/imprest/requests', $this->imprestPayload());

        $response->assertCreated()
                 ->assertJsonPath('data.status', 'draft')
                 ->assertJsonPath('data.budget_line', 'Programme 1 — Activities');

        $this->assertDatabaseHas('imprest_requests', [
            'requester_id' => $user->id,
            'status'       => 'draft',
        ]);
    }

    public function test_creating_request_requires_mandatory_fields(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/imprest/requests', [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors([
                 'budget_line',
                 'amount_requested',
                 'expected_liquidation_date',
                 'purpose',
             ]);
    }

    public function test_amount_must_be_positive(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/imprest/requests', $this->imprestPayload(['amount_requested' => 0]))
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['amount_requested']);
    }

    public function test_liquidation_date_must_be_in_the_future(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/imprest/requests', $this->imprestPayload([
            'expected_liquidation_date' => now()->toDateString(), // today, not after today
        ]))->assertUnprocessable()
           ->assertJsonValidationErrors(['expected_liquidation_date']);
    }

    public function test_staff_can_submit_their_draft(): void
    {
        [$http, $user] = $this->asStaff();

        $create = $http->postJson('/api/v1/imprest/requests', $this->imprestPayload());
        $create->assertCreated();
        $id = $create->json('data.id');

        $submit = $http->postJson("/api/v1/imprest/requests/{$id}/submit");
        $submit->assertOk()
               ->assertJsonPath('data.status', 'submitted');
    }

    public function test_finance_controller_can_approve_submitted_imprest(): void
    {
        $tenant = Tenant::factory()->create();

        $staff   = $this->makeUser('staff', $tenant);
        $finance = $this->makeUser('Finance Controller', $tenant);

        $imprest = ImprestRequest::factory()->submitted()->create([
            'tenant_id'    => $tenant->id,
            'requester_id' => $staff->id,
        ]);

        $response = $this->asUser($finance)
             ->postJson("/api/v1/imprest/requests/{$imprest->id}/approve", [
                 'amount_approved' => 1500.00,
             ]);

        $response->assertOk()
                 ->assertJsonPath('data.status', 'approved');
    }

    public function test_requester_can_retire_their_approved_imprest(): void
    {
        $tenant = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);

        $imprest = ImprestRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $requester->id,
            'amount_approved' => 1500.00,
        ]);

        $response = $this->asUser($requester)->postJson("/api/v1/imprest/requests/{$imprest->id}/retire", [
            'amount_liquidated' => 1325.50,
            'notes' => 'Workshop stationery and transport costs settled.',
            'receipts_attached' => true,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.status', 'liquidated')
            ->assertJsonPath('data.amount_liquidated', 1325.5);

        $this->assertDatabaseHas('imprest_requests', [
            'id' => $imprest->id,
            'status' => 'liquidated',
            'amount_liquidated' => 1325.50,
        ]);
    }

    public function test_cannot_retire_imprest_that_is_not_approved(): void
    {
        $tenant = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);

        $imprest = ImprestRequest::factory()->submitted()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $requester->id,
        ]);

        $this->asUser($requester)
            ->postJson("/api/v1/imprest/requests/{$imprest->id}/retire", [
                'amount_liquidated' => 500,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);
    }

    public function test_other_staff_member_cannot_retire_someone_elses_imprest(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);
        $other = $this->makeUser('staff', $tenant);

        $imprest = ImprestRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $owner->id,
            'amount_approved' => 900.00,
        ]);

        $this->asUser($other)
            ->postJson("/api/v1/imprest/requests/{$imprest->id}/retire", [
                'amount_liquidated' => 900.00,
            ])
            ->assertForbidden();
    }

    public function test_draft_request_can_be_deleted(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $imprest = ImprestRequest::factory()->create([
            'tenant_id'    => $tenant->id,
            'requester_id' => $user->id,
        ]);

        $http->deleteJson("/api/v1/imprest/requests/{$imprest->id}")
             ->assertOk();

        $this->assertSoftDeleted('imprest_requests', ['id' => $imprest->id]);
    }

    public function test_submitted_request_cannot_be_deleted(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $imprest = ImprestRequest::factory()->submitted()->create([
            'tenant_id'    => $tenant->id,
            'requester_id' => $user->id,
        ]);

        $http->deleteJson("/api/v1/imprest/requests/{$imprest->id}")
             ->assertStatus(422);
    }
}
