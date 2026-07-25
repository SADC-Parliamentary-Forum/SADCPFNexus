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
        'auth/logout',
        'auth/me',
        'auth/force-reset-password',
        'profile/password',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $required = filter_var(
            env('REQUIRE_PRIVILEGED_MFA', app()->environment('production') ? 'true' : 'false'),
            FILTER_VALIDATE_BOOLEAN
        );
        // Never lock out PHPUnit / CI even if env is mis-set.
        if (app()->environment('testing') || ! $required) {
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
        // path like api/v1/profile/2fa/enable
        foreach (self::ALLOWED_PATH_SUFFIXES as $suffix) {
            if (str_ends_with($path, $suffix)) {
                return $next($request);
            }
        }

        return response()->json([
            'message'            => 'Multi-factor authentication is required for your role. Enable MFA to continue.',
            'mfa_setup_required' => true,
        ], 403);
    }
}
