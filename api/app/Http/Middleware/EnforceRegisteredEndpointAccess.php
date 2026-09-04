<?php

namespace App\Http\Middleware;

use App\Models\AccessControl\PermissionUsageEvent;
use App\Modules\AccessControl\Services\EndpointPermissionMap;
use App\Modules\AccessControl\Services\PolicyDecisionPoint;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Routing\Route as LaravelRoute;
use Symfony\Component\HttpFoundation\Response;

/**
 * Endpoint PEP driven by the canonical permission registry.
 *
 * ACCESS_CONTROL_ENDPOINT_ENFORCEMENT:
 * - off: disabled
 * - report: log unmapped/denied endpoint facts without blocking
 * - mapped: enforce registry, route-middleware, and fallback-rule permissions; report unmapped endpoints (migration default)
 * - enforce: deny unmapped endpoints and deny if no mapped permission allows access
 */
class EnforceRegisteredEndpointAccess
{
    public function __construct(
        private readonly EndpointPermissionMap $endpoints,
        private readonly PolicyDecisionPoint $pdp,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $mode = strtolower((string) config('access_control.endpoint_enforcement_mode', 'mapped'));
        if (! in_array($mode, ['off', 'report', 'mapped', 'enforce'], true)) {
            $mode = 'report';
        }

        if ($mode === 'off') {
            return $next($request);
        }

        $user = $request->user();
        $route = $request->route();
        if (! $user || ! $route instanceof LaravelRoute || $this->isExempt($request)) {
            return $next($request);
        }

        $method = $request->isMethod('HEAD') ? 'GET' : $request->method();
        $registeredPermissions = $this->endpoints->registeredPermissionsForRoute($route, $method);
        $middlewarePermissionGroups = $this->endpoints->middlewarePermissionGroupsForRoute($route);
        $fallbackPermissionGroups = $this->endpoints->fallbackPermissionGroupsForRoute($route, $method);
        $requiredPermissionGroups = $registeredPermissions !== []
            ? [$registeredPermissions]
            : ($middlewarePermissionGroups !== [] ? $middlewarePermissionGroups : $fallbackPermissionGroups);
        $source = $registeredPermissions !== []
            ? 'endpoint_registry'
            : ($middlewarePermissionGroups !== [] ? 'route_middleware' : 'fallback_rule');
        $context = [
            'route' => $request->path(),
            'method' => $request->method(),
            'endpoint_keys' => $this->endpoints->endpointKeys($route),
            'registered_permissions' => $registeredPermissions,
            'middleware_permission_groups' => $middlewarePermissionGroups,
            'fallback_permission_groups' => $fallbackPermissionGroups,
            'access_source' => $source,
        ];

        if ($requiredPermissionGroups === []) {
            $this->record($request, 'report', '__unmapped_endpoint__', 'unmapped_endpoint', $context);

            if ($mode === 'enforce') {
                return response()->json(['message' => __('Endpoint is not registered for access control.')], 403);
            }

            return $next($request);
        }

        $matchedPermissions = [];
        foreach ($requiredPermissionGroups as $group) {
            $matchedPermission = null;

            foreach ($group as $permission) {
                $decision = $this->pdp->authorize($user, $permission, null, $context);
                if ($decision->allowed) {
                    $matchedPermission = $permission;
                    break;
                }
            }

            if ($matchedPermission === null) {
                $deniedPermissions = implode('|', $group);

                if (in_array($mode, ['mapped', 'enforce'], true)) {
                    return response()->json(['message' => __('You do not have access to this endpoint.')], 403);
                }

                $this->record($request, 'report', $deniedPermissions, 'endpoint_permission_denied_report_only', $context, $source);

                return $next($request);
            }

            $matchedPermissions[] = $matchedPermission;
        }

        $request->attributes->set('access_permissions', $matchedPermissions);
        $request->attributes->set('access_permission', $matchedPermissions[array_key_last($matchedPermissions)]);

        return $next($request);
    }

    private function isExempt(Request $request): bool
    {
        $path = trim($request->path(), '/');

        foreach (config('access_control.endpoint_enforcement_exemptions', []) as $pattern) {
            $pattern = trim((string) $pattern, '/');
            if ($pattern === $path || str_ends_with($pattern, '*') && str_starts_with($path, rtrim($pattern, '*'))) {
                return true;
            }
        }

        return false;
    }

    private function record(
        Request $request,
        string $decision,
        string $permission,
        string $reason,
        array $context,
        string $source = 'endpoint_registry',
    ): void
    {
        try {
            PermissionUsageEvent::create([
                'tenant_id' => $request->user()?->tenant_id,
                'actor_id' => $request->user()?->id,
                'permission_key' => $permission,
                'decision' => $decision,
                'reason_code' => $reason,
                'source' => $source,
                'context' => $context,
                'correlation_id' => $request->attributes->get('request_id'),
                'occurred_at' => now(),
            ]);
        } catch (\Throwable) {
            // Report-only evidence cannot break normal requests.
        }
    }
}
