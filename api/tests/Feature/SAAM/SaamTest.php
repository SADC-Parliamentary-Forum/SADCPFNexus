<?php

namespace Tests\Feature\SAAM;

use Tests\TestCase;

class SaamTest extends TestCase
{
    public function test_unauthenticated_cannot_access_saam_profile(): void
    {
        $this->getJson('/api/v1/saam/profile')->assertUnauthorized();
    }

    public function test_authenticated_user_can_get_saam_profile(): void
    {
        [$http] = $this->asStaff();

        // Returns 200 even if no signature yet (empty profile)
        $http->getJson('/api/v1/saam/profile')->assertOk();
    }

    public function test_authenticated_user_can_list_delegations(): void
    {
        [$http] = $this->asStaff();

        $http->getJson('/api/v1/saam/delegations')->assertOk();
    }

    public function test_user_can_create_delegation(): void
    {
        [$http, $user] = $this->asStaff();

        // Create a delegate
        $delegate = $this->makeUser('staff', null);

        $http->postJson('/api/v1/saam/delegations', [
            'delegate_id' => $delegate->id,
            'valid_from'  => now()->toDateString(),
            'valid_until' => now()->addDays(7)->toDateString(),
            'scope'       => 'travel',
        ])->assertCreated();
    }

    public function test_delegation_requires_delegate_id(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/saam/delegations', [
            'valid_from'  => now()->toDateString(),
            'valid_until' => now()->addDays(3)->toDateString(),
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['delegate_id']);
    }

    public function test_user_can_revoke_delegation(): void
    {
        [$http, $user] = $this->asStaff();
        $delegate = $this->makeUser('staff', null);

        $createResponse = $http->postJson('/api/v1/saam/delegations', [
            'delegate_id' => $delegate->id,
            'valid_from'  => now()->toDateString(),
            'valid_until' => now()->addDays(7)->toDateString(),
            'scope'       => 'all',
        ]);

        $createResponse->assertCreated();
        $delegationId = $createResponse->json('id');

        $http->deleteJson("/api/v1/saam/delegations/{$delegationId}")->assertOk();
    }
}
