<?php

namespace App\Modules\AccessControl\Services;

use App\Models\AccessControl\AccessRoleAssignment;
use App\Models\AccessControl\UserPermissionDenial;
use App\Models\AccessControl\UserPermissionGrant;
use App\Models\PeopleAuthority\IdentityDelegation;
use App\Models\User;
use Illuminate\Routing\Route as LaravelRoute;
use Illuminate\Support\Facades\Route;

class AccessManifestService
{
    public function __construct(
        private readonly PermissionRegistry $registry,
        private readonly PolicyDecisionPoint $pdp,
        private readonly NavigationManifestService $navigation,
        private readonly EndpointPermissionMap $endpoints,
    ) {}

    public function effective(User $user): array
    {
        $permissions = $this->pdp->effectivePermissions($user);
        sort($permissions);

        return [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'tenant_id' => $user->tenant_id,
                'account_status' => $user->account_status,
                'mfa_enabled' => (bool) ($user->mfa_enabled ?? false),
            ],
            'roles' => $user->getRoleNames()->values()->all(),
            'permissions' => $permissions,
            'permission_count' => count($permissions),
            'registry_hash' => $this->registryHash(),
            'navigation' => $this->navigation->forUser($user),
            'mfa_required_permissions' => $this->mfaRequiredPermissions($permissions),
            'direct_grants' => $this->activeGrants($user),
            'denials' => $this->activeDenials($user),
            'role_assignments' => $this->activeRoleAssignments($user),
            'delegations' => $this->activeDelegations($user),
        ];
    }

    public function coverage(): array
    {
        $registeredEndpoints = $this->endpoints->registeredEndpoints();
        $registeredRoutes = $this->registeredRoutes();
        $authenticatedRoutes = [];
        $unknownMiddlewarePermissions = [];
        $unmappedAuthenticatedEndpoints = [];
        $exemptAuthenticatedEndpoints = [];
        $centralEnforcedEndpointCount = 0;
        $routeMiddlewareEndpointCount = 0;
        $registeredEndpointRouteCount = 0;
        $fallbackEndpointCount = 0;
        $fallbackMatchedEndpointCount = 0;

        foreach (Route::getRoutes() as $route) {
            if (! $route instanceof LaravelRoute) {
                continue;
            }

            $endpointKeys = $this->endpoints->endpointKeys($route);
            if ($endpointKeys === []) {
                continue;
            }

            $middleware = $route->gatherMiddleware();
            $isAuthenticated = collect($middleware)->contains(
                fn ($mw) => is_string($mw) && ($mw === 'auth:sanctum' || str_starts_with($mw, 'auth:'))
            );
            if (! $isAuthenticated) {
                continue;
            }

            $registeredPermissions = $this->endpoints->registeredPermissionsForRoute($route);
            $middlewarePermissionGroups = $this->endpoints->middlewarePermissionGroupsForRoute($route);
            $middlewarePermissions = $this->endpoints->middlewarePermissionsForRoute($route);
            $fallbackPermissionGroups = $this->endpoints->fallbackPermissionGroupsForRoute($route);
            $fallbackPermissions = $this->endpoints->fallbackPermissionsForRoute($route);
            foreach ($middlewarePermissions as $permission) {
                if (! $this->registry->exists($permission)) {
                    $unknownMiddlewarePermissions[$permission][] = $route->uri();
                }
            }

            $hasRegisteredEndpoint = $registeredPermissions !== [];
            $hasMiddlewarePermissions = $middlewarePermissionGroups !== [];
            $hasFallbackPermissions = $fallbackPermissionGroups !== [];
            $isExempt = $this->isExemptPath($route->uri());
            if ($hasRegisteredEndpoint || $hasMiddlewarePermissions || $hasFallbackPermissions) {
                $centralEnforcedEndpointCount++;
            }
            if ($hasRegisteredEndpoint) {
                $registeredEndpointRouteCount++;
            }
            if ($hasMiddlewarePermissions) {
                $routeMiddlewareEndpointCount++;
            }
            if ($hasFallbackPermissions) {
                $fallbackMatchedEndpointCount++;
            }
            if ($hasFallbackPermissions && ! $hasRegisteredEndpoint && ! $hasMiddlewarePermissions) {
                $fallbackEndpointCount++;
            }

            if (! $hasRegisteredEndpoint && ! $hasMiddlewarePermissions && ! $hasFallbackPermissions && ! $isExempt) {
                $unmappedAuthenticatedEndpoints[] = [
                    'methods' => $this->methods($route),
                    'endpoint_keys' => $endpointKeys,
                    'uri' => '/'.ltrim($route->uri(), '/'),
                    'action' => $route->getActionName(),
                ];
            }
            if ($isExempt) {
                $exemptAuthenticatedEndpoints[] = [
                    'methods' => $this->methods($route),
                    'endpoint_keys' => $endpointKeys,
                    'uri' => '/'.ltrim($route->uri(), '/'),
                    'action' => $route->getActionName(),
                ];
            }

            $authenticatedRoutes[] = [
                'methods' => $this->methods($route),
                'endpoint_keys' => $endpointKeys,
                'uri' => '/'.ltrim($route->uri(), '/'),
                'central_enforcement_source' => $hasRegisteredEndpoint
                    ? 'endpoint_registry'
                    : ($hasMiddlewarePermissions ? 'route_middleware' : ($hasFallbackPermissions ? 'fallback_rule' : ($isExempt ? 'exempt' : null))),
                'middleware_permission_groups' => $middlewarePermissionGroups,
                'middleware_permissions' => $middlewarePermissions,
                'fallback_permission_groups' => $fallbackPermissionGroups,
                'fallback_permissions' => $fallbackPermissions,
                'registered_permissions' => $registeredPermissions,
                'effective_endpoint_permissions' => array_values(array_unique(array_merge(
                    $registeredPermissions,
                    $middlewarePermissions,
                    $fallbackPermissions
                ))),
            ];
        }

        return [
            'registry_hash' => $this->registryHash(),
            'endpoint_enforcement_mode' => config('access_control.endpoint_enforcement_mode', 'report'),
            'permission_count' => count($this->registry->all()),
            'registered_route_count' => count($registeredRoutes),
            'registered_endpoint_count' => count($registeredEndpoints),
            'authenticated_endpoint_count' => count($authenticatedRoutes),
            'central_enforced_endpoint_count' => $centralEnforcedEndpointCount,
            'registered_endpoint_route_count' => $registeredEndpointRouteCount,
            'route_middleware_endpoint_count' => $routeMiddlewareEndpointCount,
            'fallback_endpoint_count' => $fallbackEndpointCount,
            'fallback_matched_endpoint_count' => $fallbackMatchedEndpointCount,
            'exempt_authenticated_endpoint_count' => count($exemptAuthenticatedEndpoints),
            'unmapped_authenticated_endpoint_count' => count($unmappedAuthenticatedEndpoints),
            'unknown_middleware_permission_count' => count($unknownMiddlewarePermissions),
            'unmapped_authenticated_endpoints' => array_slice($unmappedAuthenticatedEndpoints, 0, 250),
            'exempt_authenticated_endpoints' => array_slice($exemptAuthenticatedEndpoints, 0, 100),
            'unknown_middleware_permissions' => $unknownMiddlewarePermissions,
            'registered_endpoints' => $registeredEndpoints,
            'authenticated_endpoints' => array_slice($authenticatedRoutes, 0, 500),
            'registered_routes' => $registeredRoutes,
        ];
    }

    private function registryHash(): string
    {
        return hash('sha256', json_encode([
            'permissions' => $this->registry->all(),
            'legacy_aliases' => config('access_control.legacy_aliases', []),
            'role_templates' => $this->registry->roleTemplates(),
        ], JSON_THROW_ON_ERROR));
    }

    private function mfaRequiredPermissions(array $permissions): array
    {
        return array_values(array_filter($permissions, function (string $permission): bool {
            return (bool) ($this->registry->get($permission)['mfa_required'] ?? false);
        }));
    }

    private function activeGrants(User $user): array
    {
        return UserPermissionGrant::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->orderBy('permission_key')
            ->get(['id', 'permission_key', 'scope_type', 'scope_reference', 'valid_from', 'valid_until', 'reason'])
            ->toArray();
    }

    private function activeDenials(User $user): array
    {
        return UserPermissionDenial::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->orderBy('permission_key')
            ->get(['id', 'permission_key', 'scope_type', 'scope_reference', 'valid_from', 'valid_until', 'reason'])
            ->toArray();
    }

    private function activeRoleAssignments(User $user): array
    {
        return AccessRoleAssignment::query()
            ->with('roleVersion.catalogue')
            ->where('user_id', $user->id)
            ->whereIn('status', ['active', 'pending_approval'])
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->map(fn (AccessRoleAssignment $assignment) => [
                'id' => $assignment->id,
                'status' => $assignment->status,
                'assignment_type' => $assignment->assignment_type,
                'scope_type' => $assignment->scope_type,
                'scope_reference' => $assignment->scope_reference,
                'valid_from' => $assignment->valid_from,
                'valid_until' => $assignment->valid_until,
                'role' => $assignment->roleVersion?->catalogue?->name,
                'role_version' => $assignment->roleVersion?->version,
            ])
            ->values()
            ->all();
    }

    private function activeDelegations(User $user): array
    {
        if (! class_exists(IdentityDelegation::class)) {
            return [];
        }

        return IdentityDelegation::query()
            ->where(function ($query) use ($user) {
                $query->where('principal_user_id', $user->id)
                    ->orWhere('delegate_user_id', $user->id);
            })
            ->whereIn('status', ['approved', 'active'])
            ->where(function ($query) {
                $query->whereNull('start_at')->orWhere('start_at', '<=', now());
            })
            ->where(function ($query) {
                $query->whereNull('end_at')->orWhere('end_at', '>', now());
            })
            ->orderByDesc('id')
            ->limit(50)
            ->get(['id', 'principal_user_id', 'delegate_user_id', 'delegation_type', 'start_at', 'end_at', 'reason', 'status'])
            ->toArray();
    }

    private function registeredRoutes(): array
    {
        $routes = [];
        foreach ($this->registry->all() as $permission => $meta) {
            foreach ($meta['linked_routes'] ?? [] as $route) {
                $routes[$route][] = $permission;
            }
        }

        ksort($routes);

        return $routes;
    }

    private function methods(LaravelRoute $route): array
    {
        return $this->endpoints->methods($route);
    }

    private function isExemptPath(string $path): bool
    {
        $path = trim($path, '/');

        foreach (config('access_control.endpoint_enforcement_exemptions', []) as $pattern) {
            $pattern = trim((string) $pattern, '/');
            if ($pattern === $path || str_ends_with($pattern, '*') && str_starts_with($path, rtrim($pattern, '*'))) {
                return true;
            }
        }

        return false;
    }
}
