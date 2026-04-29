<?php

namespace App\Http\Middleware;

use App\Models\UserSession;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureSessionAuthIsValid
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return $next($request);
        }

        if (! $user->is_active) {
            $this->revokeCurrentAuth($request);

            return response()->json([
                'message' => 'This account has been deactivated.',
            ], 403);
        }

        $currentToken = $user->currentAccessToken();

        if ($currentToken instanceof \Laravel\Sanctum\PersonalAccessToken) {
            UserSession::updateOrCreate(
                [
                    'user_id'   => $user->id,
                    'token_id'  => $currentToken->id,
                    'auth_type' => 'token',
                ],
                [
                    'session_id'     => null,
                    'ip_address'     => $request->ip(),
                    'user_agent'     => $request->userAgent(),
                    'last_active_at' => now(),
                ]
            );

            return $next($request);
        }

        if (! $request->hasSession()) {
            return $next($request);
        }

        $sessionId = $request->session()->getId();

        $trackedSession = UserSession::where('user_id', $user->id)
            ->where('auth_type', 'browser')
            ->where('session_id', $sessionId)
            ->first();

        if (! $trackedSession) {
            $this->revokeCurrentAuth($request);

            return response()->json([
                'message' => 'Your browser session is no longer valid.',
            ], 401);
        }

        $trackedSession->forceFill([
            'ip_address'     => $request->ip(),
            'user_agent'     => $request->userAgent(),
            'last_active_at' => now(),
        ])->save();

        return $next($request);
    }

    private function revokeCurrentAuth(Request $request): void
    {
        if (($token = $request->user()?->currentAccessToken()) instanceof \Laravel\Sanctum\PersonalAccessToken) {
            $token->delete();
        }

        if ($request->hasSession()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }
    }
}
