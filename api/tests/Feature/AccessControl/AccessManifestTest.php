<?php

namespace Tests\Feature\AccessControl;

use App\Models\AccessControl\PermissionUsageEvent;
use App\Modules\AccessControl\Services\PolicyDecisionPoint;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccessManifestTest extends TestCase
{
    public function test_effective_access_endpoint_returns_backend_manifest(): void
    {
        $user = $this->makeUser('staff');
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/access/effective')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'user' => ['id', 'name', 'email', 'tenant_id'],
                    'roles',
                    'permissions',
                    'permission_count',
                    'registry_hash',
                    'navigation' => ['items', 'effective_permission_count'],
                    'mfa_required_permissions',
                    'direct_grants',
                    'denials',
                    'role_assignments',
                    'delegations',
                ],
            ])
            ->assertJsonPath('data.user.id', $user->id);

        $payload = $this->getJson('/api/v1/access/effective')->json('data');
        $this->assertContains('leave.request.read.self', $payload['permissions']);
        $this->assertNotSame('', $payload['registry_hash']);
    }

    public function test_access_coverage_endpoint_requires_explorer_permission(): void
    {
        $staff = $this->makeUser('staff');
        Sanctum::actingAs($staff);
        $this->getJson('/api/v1/admin/access/coverage')->assertStatus(403);

        $admin = $this->makeUser('Security and Access Administrator');
        Sanctum::actingAs($admin);
        $this->getJson('/api/v1/admin/access/coverage')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'registry_hash',
                    'endpoint_enforcement_mode',
                    'permission_count',
                    'registered_route_count',
                    'registered_endpoint_count',
                    'authenticated_endpoint_count',
                    'central_enforced_endpoint_count',
                    'registered_endpoint_route_count',
                    'route_middleware_endpoint_count',
                    'fallback_endpoint_count',
                    'fallback_matched_endpoint_count',
                    'exempt_authenticated_endpoint_count',
                    'unmapped_authenticated_endpoint_count',
                    'unknown_middleware_permission_count',
                    'unmapped_authenticated_endpoints',
                    'exempt_authenticated_endpoints',
                    'unknown_middleware_permissions',
                    'registered_endpoints',
                    'authenticated_endpoints',
                    'registered_routes',
                ],
            ]);

        $payload = $this->getJson('/api/v1/admin/access/coverage')->json('data');
        $this->assertSame('mapped', $payload['endpoint_enforcement_mode']);
        $this->assertContains(
            'admin.access.explore',
            $payload['registered_endpoints']['GET /api/v1/admin/access/coverage']
        );
    }

    public function test_pdp_records_permission_usage_events(): void
    {
        $user = $this->makeUser('staff');
        $pdp = app(PolicyDecisionPoint::class);

        $this->assertTrue($pdp->can($user, 'leave.request.read.self'));
        $this->assertFalse($pdp->can($user, 'admin.roles.manage'));

        $this->assertDatabaseHas('permission_usage_events', [
            'actor_id' => $user->id,
            'permission_key' => 'leave.request.read.self',
            'decision' => 'allow',
            'reason_code' => 'role_or_permission',
        ]);

        $this->assertDatabaseHas('permission_usage_events', [
            'actor_id' => $user->id,
            'permission_key' => 'admin.roles.manage',
            'decision' => 'deny',
            'reason_code' => 'missing_permission',
        ]);

        $this->assertSame(2, PermissionUsageEvent::query()->where('actor_id', $user->id)->count());
    }
}
