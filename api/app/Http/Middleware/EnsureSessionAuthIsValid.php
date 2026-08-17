<?php

namespace App\Http\Middleware;

use App\Models\UserSession;
use App\Models\AuditLog;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

class EnsureSessionAuthIsValid
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return $next($request);
        }

        if (! $user->accountAllowsAuthentication()) {
            AuditLog::record('auth.session_blocked', [
                'auditable_type' => \App\Models\User::class,
                'auditable_id'   => $user->id,
                'new_values'     => ['reason' => $user->authenticationBlockReason()],
                'tags'           => 'auth',
            ]);

            $this->revokeCurrentAuth($request);

            return response()->json([
                'message' => 'This account is not active.',
            ], 403);
        }

        $idleResponse = $this->rejectIfIdle($request, $user);
        if ($idleResponse !== null) {
            return $idleResponse;
        }

        $currentToken = $user->currentAccessToken();

        if ($currentToken instanceof PersonalAccessToken) {
            $tokenId = $currentToken->getKey();

            UserSession::updateOrCreate(
                [
                    'user_id'   => $user->id,
                    'token_id'  => $tokenId,
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

    private function rejectIfIdle(Request $request, $user): ?Response
    {
        $minutes = $user->idle_timeout_minutes;
        if ($minutes === null) {
            $minutes = (int) config('session.lifetime', 120);
        }
        $minutes = (int) $minutes;
        if ($minutes <= 0) {
            return null;
        }

        $tracked = $this->findTrackedSession($request, $user);
        if ($tracked === null || $tracked->last_active_at === null) {
            return null;
        }

        if ($tracked->last_active_at->gt(now()->subMinutes($minutes))) {
            return null;
        }

        $this->revokeCurrentAuth($request);

        return response()->json([
            'message' => 'You were signed out after a period of inactivity.',
            'code'    => 'session_idle_timeout',
        ], 401);
    }

    private function findTrackedSession(Request $request, $user): ?UserSession
    {
        $currentToken = $user->currentAccessToken();

        if ($currentToken instanceof PersonalAccessToken) {
            return UserSession::where('user_id', $user->id)
                ->where('token_id', $currentToken->getKey())
                ->where('auth_type', 'token')
                ->first();
        }

        if (! $request->hasSession()) {
            return null;
        }

        return UserSession::where('user_id', $user->id)
            ->where('auth_type', 'browser')
            ->where('session_id', $request->session()->getId())
            ->first();
    }

    private function revokeCurrentAuth(Request $request): void
    {
        $user = $request->user();

        $currentToken = $user?->currentAccessToken();

        if ($currentToken instanceof \Laravel\Sanctum\PersonalAccessToken) {
            $tokenId = $currentToken->getKey();
            $currentToken->delete();
            if ($tokenId !== null && $user) {
                UserSession::where('user_id', $user->id)
                    ->where('token_id', $tokenId)
                    ->where('auth_type', 'token')
                    ->delete();
            }

            return;
        }

        if ($request->hasSession()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }
    }
}
