<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class EnforceAdminMaintenanceMode
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($this->isAlwaysAllowed($request) || ! Schema::hasTable('maintenance_windows')) {
            return $next($request);
        }

        $user = $request->user();
        $tenantId = $user?->tenant_id;
        if (! $tenantId) {
            return $next($request);
        }

        $window = DB::table('maintenance_windows')
            ->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->whereIn('maintenance_mode', ['read_only', 'selected_module_disabled', 'full_platform_maintenance', 'emergency_lockdown'])
            ->where(function ($query): void {
                $query->whereNull('actual_start')->orWhere('actual_start', '<=', now());
            })
            ->where(function ($query): void {
                $query->whereNull('planned_end')->orWhere('planned_end', '>=', now());
            })
            ->orderByDesc('id')
            ->first();

        if (! $window) {
            return $next($request);
        }

        $mode = (string) $window->maintenance_mode;
        $unsafeMethod = ! $request->isMethodSafe();
        $pathModule = $this->pathModule($request);
        $readOnlyServices = $this->decodeList($window->read_only_services ?? null);
        $unavailableServices = $this->decodeList($window->unavailable_services ?? null);

        $blocked = match ($mode) {
            'read_only' => $unsafeMethod,
            'full_platform_maintenance', 'emergency_lockdown' => true,
            'selected_module_disabled' => in_array($pathModule, $unavailableServices, true)
                || ($unsafeMethod && in_array($pathModule, $readOnlyServices, true)),
            default => false,
        };

        if (! $blocked) {
            return $next($request);
        }

        return response()->json([
            'message' => 'The platform is in maintenance mode. This request is temporarily unavailable.',
            'maintenance' => [
                'reference' => $window->reference,
                'title' => $window->title,
                'mode' => $mode,
                'expected_end' => $window->planned_end,
            ],
        ], 503)->header('Retry-After', (string) $this->retryAfterSeconds($window->planned_end ?? null));
    }

    private function isAlwaysAllowed(Request $request): bool
    {
        if ($request->isMethod('OPTIONS')) {
            return true;
        }

        $path = trim($request->path(), '/');
        $allowed = [
            'api/v1/auth/logout',
            'api/v1/auth/me',
            'api/v1/admin/dashboard',
            'api/v1/admin/platform-status',
            'api/v1/admin/system-health',
            'api/v1/admin/maintenance-windows*',
            'api/v1/admin/system-banners*',
            'api/v1/admin/break-glass*',
            'api/v1/audit-events*',
            'api/v1/audit-admin*',
            'api/v1/audit-integrity*',
        ];

        foreach ($allowed as $pattern) {
            if ($pattern === $path || str_ends_with($pattern, '*') && str_starts_with($path, rtrim($pattern, '*'))) {
                return true;
            }
        }

        return false;
    }

    private function pathModule(Request $request): string
    {
        $path = Str::of($request->path())->replaceStart('api/v1/', '');

        return (string) $path->before('/');
    }

    /**
     * @return list<string>
     */
    private function decodeList(mixed $value): array
    {
        if (is_array($value)) {
            return array_values(array_map('strval', $value));
        }

        $decoded = json_decode((string) $value, true);

        return is_array($decoded) ? array_values(array_map('strval', $decoded)) : [];
    }

    private function retryAfterSeconds(?string $plannedEnd): int
    {
        if (! $plannedEnd) {
            return 300;
        }

        $seconds = now()->diffInSeconds($plannedEnd, false);

        return max(60, min(3600, (int) $seconds));
    }
}
