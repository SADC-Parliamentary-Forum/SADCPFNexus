<?php

namespace App\Modules\AccessControl\Services;

use Illuminate\Routing\Route as LaravelRoute;

class EndpointPermissionMap
{
    public function __construct(
        private readonly PermissionRegistry $registry,
        private readonly ?array $fallbackRules = null,
    ) {}

    /**
     * @return array<string, list<string>>
     */
    public function registeredEndpoints(): array
    {
        $endpoints = [];

        foreach ($this->registry->all() as $permission => $meta) {
            foreach ($meta['linked_endpoints'] ?? [] as $endpoint) {
                $endpoints[$this->normalizeEndpoint($endpoint)][] = $permission;
            }
        }

        foreach ($endpoints as $endpoint => $permissions) {
            $endpoints[$endpoint] = array_values(array_unique($permissions));
        }
        ksort($endpoints);

        return $endpoints;
    }

    /**
     * @return list<string>
     */
    public function permissionsFor(string $method, string $uri): array
    {
        $method = strtoupper($method);
        $uri = '/'.ltrim($uri, '/');

        return $this->registeredEndpoints()[$method.' '.$uri] ?? [];
    }

    /**
     * @return list<string>
     */
    public function permissionsForRoute(LaravelRoute $route): array
    {
        return array_values(array_unique(array_merge(
            $this->registeredPermissionsForRoute($route),
            $this->middlewarePermissionsForRoute($route),
            $this->fallbackPermissionsForRoute($route),
        )));
    }

    /**
     * @return list<string>
     */
    public function registeredPermissionsForRoute(LaravelRoute $route, ?string $method = null): array
    {
        $permissions = [];

        foreach ($this->endpointKeys($route, $method) as $key) {
            $permissions = array_merge($permissions, $this->registeredEndpoints()[$key] ?? []);
        }

        return array_values(array_unique($permissions));
    }

    /**
     * @return list<string>
     */
    public function middlewarePermissionsForRoute(LaravelRoute $route): array
    {
        $groups = $this->middlewarePermissionGroupsForRoute($route);
        if ($groups === []) {
            return [];
        }

        return array_values(array_unique(array_merge(...$groups)));
    }

    /**
     * Route middleware semantics are cumulative: each middleware entry must pass,
     * while Spatie's permission middleware may allow alternatives with "|".
     *
     * @return list<list<string>>
     */
    public function middlewarePermissionGroupsForRoute(LaravelRoute $route): array
    {
        return $this->permissionGroupsFromMiddleware($route->gatherMiddleware());
    }

    /**
     * @return list<string>
     */
    public function fallbackPermissionsForRoute(LaravelRoute $route, ?string $method = null): array
    {
        $groups = $this->fallbackPermissionGroupsForRoute($route, $method);
        if ($groups === []) {
            return [];
        }

        return array_values(array_unique(array_merge(...$groups)));
    }

    /**
     * @return list<list<string>>
     */
    public function fallbackPermissionGroupsForRoute(LaravelRoute $route, ?string $method = null): array
    {
        $methods = $method !== null
            ? [$this->normalizeMethod($method)]
            : $this->methods($route);
        $uri = trim($route->uri(), '/');
        $groups = [];

        foreach ($methods as $routeMethod) {
            foreach ($this->fallbackRules() as $rule) {
                $pattern = trim((string) ($rule['pattern'] ?? ''), '/');
                if ($pattern === '' || ! $this->matchesPattern($pattern, $uri)) {
                    continue;
                }

                $group = $this->permissionsForRuleAndMethod($rule['permissions'] ?? [], $routeMethod);
                if ($group !== []) {
                    $groups[] = $group;
                }
                break;
            }
        }

        return $this->uniqueGroups($groups);
    }

    /**
     * @param  list<string>  $middleware
     * @return list<list<string>>
     */
    public function permissionGroupsFromMiddleware(array $middleware): array
    {
        $groups = [];

        foreach ($middleware as $entry) {
            if (! is_string($entry)) {
                continue;
            }

            if (str_starts_with($entry, 'can:')) {
                $permission = trim(strtok(substr($entry, 4), ',') ?: '');
                if ($permission !== '') {
                    $groups[] = [$permission];
                }
                continue;
            }

            if (str_starts_with($entry, 'permission:') || str_starts_with($entry, 'access:')) {
                [, $raw] = explode(':', $entry, 2);
                $raw = strtok($raw, ',') ?: '';
                $permissions = array_values(array_filter(array_map('trim', explode('|', $raw))));
                if ($permissions !== []) {
                    $groups[] = array_values(array_unique($permissions));
                }
            }
        }

        return $groups;
    }

    /**
     * @return list<string>
     */
    public function endpointKeys(LaravelRoute $route, ?string $method = null): array
    {
        $uri = '/'.ltrim($route->uri(), '/');
        $methods = $method !== null ? [$this->normalizeMethod($method)] : $this->methods($route);

        return array_map(
            fn (string $method) => $method.' '.$uri,
            $methods
        );
    }

    /**
     * @return list<string>
     */
    public function methods(LaravelRoute $route): array
    {
        return array_values(array_unique(array_filter(
            array_map(fn (string $method) => $this->normalizeMethod($method), $route->methods()),
            fn (string $method) => $method !== 'HEAD'
        )));
    }

    public function normalizeEndpoint(string $endpoint): string
    {
        $endpoint = trim(preg_replace('/\s+/', ' ', $endpoint) ?? $endpoint);
        [$method, $uri] = array_pad(explode(' ', $endpoint, 2), 2, '');

        return strtoupper($method).' /'.ltrim($uri, '/');
    }

    private function normalizeMethod(string $method): string
    {
        $method = strtoupper($method);

        return $method === 'HEAD' ? 'GET' : $method;
    }

    private function fallbackRules(): array
    {
        return $this->fallbackRules ?? config('access_control.endpoint_fallback_permission_rules', []);
    }

    private function matchesPattern(string $pattern, string $uri): bool
    {
        if (str_ends_with($pattern, '*')) {
            return str_starts_with($uri, rtrim($pattern, '*'));
        }

        return $pattern === $uri;
    }

    /**
     * @param  array<string, list<string>>  $permissions
     * @return list<string>
     */
    private function permissionsForRuleAndMethod(array $permissions, string $method): array
    {
        $method = $this->normalizeMethod($method);
        $bucket = in_array($method, ['GET', 'OPTIONS'], true) ? 'READ' : 'WRITE';
        $group = $permissions[$method]
            ?? $permissions[$bucket]
            ?? $permissions['*']
            ?? [];

        return array_values(array_unique(array_filter(array_map('trim', $group))));
    }

    /**
     * @param  list<list<string>>  $groups
     * @return list<list<string>>
     */
    private function uniqueGroups(array $groups): array
    {
        $seen = [];
        $unique = [];

        foreach ($groups as $group) {
            $group = array_values(array_unique($group));
            $key = implode('|', $group);
            if ($key === '' || isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $unique[] = $group;
        }

        return $unique;
    }
}
