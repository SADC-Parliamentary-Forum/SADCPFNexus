<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Privileged roles must have MFA enabled before using the API (except MFA setup routes).
 */
class RequireMfaForPrivileged
{
    /** @var list<string> */
    private const PRIVILEGED_ROLES = [
        'System Admin',
        'System Administrator',
        'super-admin',
        'Secretary General',
        'Finance Controller',
        'HR Manager',
        'HR Administrator',
        'Procurement Officer',
    ];

    /** @var list<string> */
    private const ALLOWED_PATH_SUFFIXES = [
        'profile/2fa/status',
        'profile/2fa/enable',
        'profile/2fa/confirm',
        'profile/2fa/disable',
        'profile/2fa/verify',
        'profile/sessions',
        'profile/sessions/others',
        'profile/password',
        'auth/logout',
        'auth/me',
        'auth/force-reset-password',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $required = (bool) config('auth.require_privileged_mfa');
        if (! $required) {
            return $next($request);
        }
        // PHPUnit stays open unless a test opts into the production gate.
        if (app()->environment('testing') && ! config('auth.enforce_privileged_mfa_in_tests')) {
            return $next($request);
        }

        $user = $request->user();
        if (! $user) {
            return $next($request);
        }

        if (! $user->hasAnyRole(self::PRIVILEGED_ROLES)) {
            return $next($request);
        }

        if ($user->mfa_enabled) {
            return $next($request);
        }

        $path = trim($request->path(), '/');
        // path like api/v1/profile/2fa/enable — also allow profile/sessions/{id}
        foreach (self::ALLOWED_PATH_SUFFIXES as $suffix) {
            if (str_ends_with($path, $suffix)) {
                return $next($request);
            }
        }
        if (preg_match('#(^|/)profile/sessions/\d+$#', $path) === 1) {
            return $next($request);
        }

        return response()->json([
            'message'            => 'Multi-factor authentication is required for your role. Enable MFA to continue.',
            'mfa_setup_required' => true,
        ], 403);
    }
}
