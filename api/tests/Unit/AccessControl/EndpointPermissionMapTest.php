<?php

namespace Tests\Unit\AccessControl;

use App\Modules\AccessControl\Services\EndpointPermissionMap;
use App\Modules\AccessControl\Services\PermissionRegistry;
use Illuminate\Routing\Route as LaravelRoute;
use PHPUnit\Framework\TestCase;

class EndpointPermissionMapTest extends TestCase
{
    public function test_normalizes_endpoint_keys_and_returns_unique_permissions(): void
    {
        $map = new EndpointPermissionMap($this->registry([
            'admin.roles.view' => [
                'linked_endpoints' => [
                    'get    api/v1/admin/access/registry',
                    'GET /api/v1/admin/access/registry',
                ],
            ],
            'admin.access.explore' => [
                'linked_endpoints' => [
                    'GET /api/v1/admin/access/coverage',
                ],
            ],
        ]), []);

        $this->assertSame('POST /admin/access/roles', $map->normalizeEndpoint(' post  admin/access/roles '));
        $this->assertSame(['admin.roles.view'], $map->permissionsFor('GET', '/api/v1/admin/access/registry'));
        $this->assertSame(['admin.access.explore'], $map->permissionsFor('get', 'api/v1/admin/access/coverage'));
    }

    public function test_resolves_permissions_from_laravel_route_signature(): void
    {
        $map = new EndpointPermissionMap($this->registry([
            'admin.roles.approve' => [
                'linked_endpoints' => [
                    'POST /api/v1/admin/access/grants/{grant}/approve',
                ],
            ],
        ]), []);

        $route = new LaravelRoute(['POST'], 'api/v1/admin/access/grants/{grant}/approve', ['uses' => fn () => null]);

        $this->assertSame(
            ['POST /api/v1/admin/access/grants/{grant}/approve'],
            $map->endpointKeys($route)
        );
        $this->assertSame(['admin.roles.approve'], $map->permissionsForRoute($route));
    }

    public function test_matches_registry_id_placeholder_to_named_route_parameter(): void
    {
        $map = new EndpointPermissionMap($this->registry([
            'procurement.evaluation.read.assigned' => [
                'linked_endpoints' => [
                    'GET /api/v1/procurement/committee-evaluations/{id}',
                ],
            ],
        ]), []);

        $route = new LaravelRoute(
            ['GET'],
            'api/v1/procurement/committee-evaluations/{procurementRequest}',
            ['uses' => fn () => null]
        );

        $this->assertSame(
            ['procurement.evaluation.read.assigned'],
            $map->permissionsForRoute($route)
        );
    }

    public function test_leave_authorise_maps_approve_endpoint_with_named_parameter(): void
    {
        $map = new EndpointPermissionMap($this->registry([
            'leave.request.authorise.assigned' => [
                'linked_endpoints' => [
                    'POST /api/v1/leave/requests/{id}/approve',
                ],
            ],
        ]), []);

        $route = new LaravelRoute(
            ['POST'],
            'api/v1/leave/requests/{leaveRequest}/approve',
            ['uses' => fn () => null]
        );

        $this->assertSame(['leave.request.authorise.assigned'], $map->permissionsForRoute($route));
    }

    public function test_extracts_route_middleware_permission_groups_without_losing_and_semantics(): void
    {
        $map = new EndpointPermissionMap($this->registry([]), []);
        $route = new LaravelRoute(['POST'], 'api/v1/mande/settings', ['uses' => fn () => null]);
        $route->middleware([
            'can:mande.view',
            'permission:mande.admin|system.admin,sanctum',
            'access:reports.view,reports',
            'role:System Admin',
        ]);

        $this->assertSame(
            [
                ['mande.view'],
                ['mande.admin', 'system.admin'],
                ['reports.view'],
            ],
            $map->middlewarePermissionGroupsForRoute($route)
        );
        $this->assertSame(
            ['mande.view', 'mande.admin', 'system.admin', 'reports.view'],
            $map->middlewarePermissionsForRoute($route)
        );
    }

    public function test_resolves_configured_fallback_permission_groups_by_prefix_and_method(): void
    {
        $rules = [
            ['pattern' => 'api/v1/admin/users*', 'permissions' => [
                'GET' => ['admin.users.view', 'users.view'],
                'WRITE' => ['admin.users.edit', 'users.edit'],
            ]],
            ['pattern' => 'api/v1/admin/*', 'permissions' => [
                '*' => ['admin.platform.manage'],
            ]],
        ];

        $map = new EndpointPermissionMap($this->registry([]), $rules);
        $showRoute = new LaravelRoute(['GET', 'HEAD'], 'api/v1/admin/users/{user}', ['uses' => fn () => null]);
        $updateRoute = new LaravelRoute(['PATCH'], 'api/v1/admin/users/{user}', ['uses' => fn () => null]);
        $settingsRoute = new LaravelRoute(['POST'], 'api/v1/admin/settings', ['uses' => fn () => null]);

        $this->assertSame([['admin.users.view', 'users.view']], $map->fallbackPermissionGroupsForRoute($showRoute));
        $this->assertSame([['admin.users.edit', 'users.edit']], $map->fallbackPermissionGroupsForRoute($updateRoute));
        $this->assertSame([['admin.platform.manage']], $map->fallbackPermissionGroupsForRoute($settingsRoute));
    }

    public function test_exact_route_parameter_pattern_beats_module_prefix(): void
    {
        $rules = [
            ['pattern' => 'api/v1/assets/{asset}/acknowledge', 'permissions' => [
                'POST' => ['assets.admin', 'my_work.view'],
            ]],
            ['pattern' => 'api/v1/assets*', 'permissions' => [
                'POST' => ['assets.create', 'assets.admin'],
            ]],
        ];

        $map = new EndpointPermissionMap($this->registry([]), $rules);
        $acknowledge = new LaravelRoute(['POST'], 'api/v1/assets/{asset}/acknowledge', ['uses' => fn () => null]);
        $capitalise = new LaravelRoute(['POST'], 'api/v1/assets/{asset}/capitalise', ['uses' => fn () => null]);

        $this->assertSame([['assets.admin', 'my_work.view']], $map->fallbackPermissionGroupsForRoute($acknowledge));
        $this->assertSame([['assets.create', 'assets.admin']], $map->fallbackPermissionGroupsForRoute($capitalise));
    }

    private function registry(array $permissions): PermissionRegistry
    {
        return new class($permissions) extends PermissionRegistry
        {
            public function __construct(private readonly array $permissions) {}

            public function all(): array
            {
                return $this->permissions;
            }
        };
    }
}
