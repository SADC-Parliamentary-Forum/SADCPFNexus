<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * Protects the external workplan feed.
 *
 * Accepts either:
 *  - Header X-External-Token matching EXTERNAL_WORKPLAN_TOKEN, or
 *  - Sanctum bearer token for a System Admin / user with workplan.external permission.
 *
 * Ordinary workplan.view is intentionally insufficient — this is a machine feed.
 */
class AuthenticateExternalWorkplan
{
    public function handle(Request $request, Closure $next): Response
    {
        $configured = (string) config('services.external_workplan.token', env('EXTERNAL_WORKPLAN_TOKEN', ''));
        $provided = (string) $request->header('X-External-Token', '');

        if ($configured !== '' && hash_equals($configured, $provided)) {
            return $next($request);
        }

        $bearer = $request->bearerToken();
        if ($bearer) {
            $accessToken = PersonalAccessToken::findToken($bearer);
            $user = $accessToken?->tokenable;
            if ($user instanceof User) {
                if ($user->isSystemAdmin() || $user->can('workplan.external')) {
                    $request->setUserResolver(fn () => $user);

                    return $next($request);
                }
            }
        }

        return response()->json([
            'message' => 'Unauthorised. Provide a valid X-External-Token or a bearer token with workplan.external.',
        ], 401);
    }
}
