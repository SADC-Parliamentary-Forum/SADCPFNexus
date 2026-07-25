<?php

namespace Tests\Feature\Security;

use App\Models\Tenant;
use App\Models\Vendor;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class ExternalWorkplanAuthTest extends TestCase
{
    public function test_external_workplan_rejects_unauthenticated_caller(): void
    {
        $this->getJson('/api/v1/external/workplan')
            ->assertUnauthorized();
    }

    public function test_external_workplan_accepts_configured_token(): void
    {
        config(['services.external_workplan.token' => 'test-external-token-xyz']);

        $this->withHeader('X-External-Token', 'test-external-token-xyz')
            ->getJson('/api/v1/external/workplan')
            ->assertOk();
    }

    public function test_external_workplan_rejects_wrong_token(): void
    {
        config(['services.external_workplan.token' => 'test-external-token-xyz']);

        $this->withHeader('X-External-Token', 'wrong')
            ->getJson('/api/v1/external/workplan')
            ->assertUnauthorized();
    }

    public function test_system_admin_bearer_can_access_external_workplan(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $token = $admin->createToken('external-workplan-test')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/v1/external/workplan')
            ->assertOk();
    }

    public function test_staff_bearer_cannot_access_external_workplan(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $token = $staff->createToken('external-workplan-test')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/v1/external/workplan')
            ->assertUnauthorized();
    }

    public function test_workplan_view_alone_cannot_access_external_workplan(): void
    {
        $tenant = Tenant::factory()->create();
        $director = $this->makeUser('Director', $tenant);
        $this->assertTrue($director->can('workplan.view'));
        $this->assertFalse($director->can('workplan.external'));

        $token = $director->createToken('external-workplan-test')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/v1/external/workplan')
            ->assertUnauthorized();
    }

    public function test_workplan_external_permission_allows_bearer_access(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $perm = Permission::findOrCreate('workplan.external', 'sanctum');
        $staff->givePermissionTo($perm);

        $token = $staff->createToken('external-workplan-test')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/v1/external/workplan')
            ->assertOk();
    }
}
