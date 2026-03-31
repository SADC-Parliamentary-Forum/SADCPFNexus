<?php

namespace Tests\Feature\Finance;

use App\Models\SalaryAdvanceRequest;
use App\Models\Tenant;
use Tests\TestCase;

class SalaryAdvanceTest extends TestCase
{
    private function advancePayload(array $overrides = []): array
    {
        return array_merge([
            'advance_type'     => 'medical',
            'amount'           => 5000.00,
            'currency'         => 'NAD',
            'purpose'          => 'Medical emergency for family member',
            'justification'    => 'Hospitalization expenses for wife requiring urgent surgery',
            'repayment_months' => 3,
        ], $overrides);
    }

    // ── Auth ─────────────────────────────────────────────────────────────────

    public function test_unauthenticated_cannot_list_advances(): void
    {
        $this->getJson('/api/v1/finance/advances')->assertUnauthorized();
    }

    // ── CRUD ─────────────────────────────────────────────────────────────────

    public function test_staff_can_create_salary_advance(): void
    {
        [$http, $user] = $this->asStaff();

        $response = $http->postJson('/api/v1/finance/advances', $this->advancePayload());

        $response->assertCreated()
                 ->assertJsonPath('data.status', 'draft')
                 ->assertJsonPath('data.amount', 5000);

        $this->assertDatabaseHas('salary_advance_requests', [
            'requester_id' => $user->id,
            'status'       => 'draft',
        ]);
    }

    public function test_create_advance_requires_advance_type_amount_and_purpose(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/finance/advances', [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['advance_type', 'amount', 'purpose', 'justification']);
    }

    public function test_amount_must_be_positive(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/finance/advances', $this->advancePayload(['amount' => -100]))
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['amount']);
    }

    public function test_staff_can_list_only_own_advances(): void
    {
        $tenant = Tenant::factory()->create();

        [$http, $myUser] = $this->asStaff($tenant);
        $otherUser = $this->makeUser('staff', $tenant);

        // Create for other user directly
        SalaryAdvanceRequest::create([
            'tenant_id'        => $tenant->id,
            'requester_id'     => $otherUser->id,
            'reference_number' => 'ADV-OTHER001',
            'advance_type'     => 'medical',
            'amount'           => 3000,
            'currency'         => 'NAD',
            'purpose'          => 'Other user advance',
            'justification'    => 'Other user justification',
            'repayment_months' => 6,
            'status'           => 'draft',
        ]);

        // Create for self via API
        $http->postJson('/api/v1/finance/advances', $this->advancePayload());

        $response = $http->getJson('/api/v1/finance/advances');
        $response->assertOk();

        $requesterIds = collect($response->json('data'))->pluck('requester_id')->unique()->values()->toArray();
        $this->assertNotContains($otherUser->id, $requesterIds);
    }

    public function test_staff_can_view_own_advance(): void
    {
        [$http, $user] = $this->asStaff();

        $create = $http->postJson('/api/v1/finance/advances', $this->advancePayload());
        $id = $create->json('data.id');

        $http->getJson("/api/v1/finance/advances/{$id}")
             ->assertOk()
             ->assertJsonPath('data.id', $id);
    }

    public function test_staff_can_update_draft_advance(): void
    {
        [$http] = $this->asStaff();

        $create = $http->postJson('/api/v1/finance/advances', $this->advancePayload());
        $id = $create->json('data.id');

        $http->putJson("/api/v1/finance/advances/{$id}", $this->advancePayload(['amount' => 7500]))
             ->assertOk()
             ->assertJsonPath('data.amount', 7500);
    }

    public function test_staff_can_delete_draft_advance(): void
    {
        [$http, $user] = $this->asStaff();

        $create = $http->postJson('/api/v1/finance/advances', $this->advancePayload());
        $id = $create->json('data.id');

        $http->deleteJson("/api/v1/finance/advances/{$id}")
             ->assertOk();

        $this->assertDatabaseMissing('salary_advance_requests', ['id' => $id]);
    }

    // ── Submit ────────────────────────────────────────────────────────────────

    public function test_staff_can_submit_draft_advance(): void
    {
        [$http] = $this->asStaff();

        $create = $http->postJson('/api/v1/finance/advances', $this->advancePayload());
        $id = $create->json('data.id');

        $submit = $http->postJson("/api/v1/finance/advances/{$id}/submit");
        $submit->assertOk()
               ->assertJsonPath('data.status', 'submitted');
    }

    public function test_staff_cannot_submit_another_users_advance(): void
    {
        $tenant = Tenant::factory()->create();
        $owner  = $this->makeUser('staff', $tenant);
        $other  = $this->makeUser('staff', $tenant);

        $advance = SalaryAdvanceRequest::create([
            'tenant_id'        => $tenant->id,
            'requester_id'     => $owner->id,
            'reference_number' => 'ADV-OWN001',
            'advance_type'     => 'medical',
            'amount'           => 5000,
            'currency'         => 'NAD',
            'purpose'          => 'Owner advance',
            'justification'    => 'Owner justification',
            'repayment_months' => 6,
            'status'           => 'draft',
        ]);

        $this->asUser($other)
             ->postJson("/api/v1/finance/advances/{$advance->id}/submit")
             ->assertForbidden();
    }

    // ── Finance Controller: Approve / Reject ──────────────────────────────────

    public function test_finance_controller_can_approve_submitted_advance(): void
    {
        $tenant = Tenant::factory()->create();
        [$staffHttp, $staff] = $this->asStaff($tenant);

        $create = $staffHttp->postJson('/api/v1/finance/advances', $this->advancePayload());
        $id = $create->json('data.id');
        $staffHttp->postJson("/api/v1/finance/advances/{$id}/submit");

        [$finHttp] = $this->asFinanceController($tenant);

        $finHttp->postJson("/api/v1/finance/advances/{$id}/approve", [
            'comment' => 'Approved — medical grounds',
        ])->assertOk()
          ->assertJsonPath('data.status', 'approved');
    }

    public function test_finance_controller_can_reject_submitted_advance(): void
    {
        $tenant = Tenant::factory()->create();
        [$staffHttp] = $this->asStaff($tenant);

        $create = $staffHttp->postJson('/api/v1/finance/advances', $this->advancePayload());
        $id = $create->json('data.id');
        $staffHttp->postJson("/api/v1/finance/advances/{$id}/submit");

        [$finHttp] = $this->asFinanceController($tenant);

        $finHttp->postJson("/api/v1/finance/advances/{$id}/reject", [
            'comment' => 'Insufficient documentation',
        ])->assertOk()
          ->assertJsonPath('data.status', 'rejected');
    }

    public function test_staff_cannot_approve_advance(): void
    {
        $tenant = Tenant::factory()->create();
        [$staffHttpA] = $this->asStaff($tenant);
        [$staffHttpB] = $this->asStaff($tenant);

        $create = $staffHttpA->postJson('/api/v1/finance/advances', $this->advancePayload());
        $id = $create->json('data.id');
        $staffHttpA->postJson("/api/v1/finance/advances/{$id}/submit");

        $staffHttpB->postJson("/api/v1/finance/advances/{$id}/approve")
                   ->assertForbidden();
    }
}
