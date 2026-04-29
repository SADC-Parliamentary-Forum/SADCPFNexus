<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\UserSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ProfileSessionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $currentTokenId = $request->user()->currentAccessToken()?->id;
        $currentSessionId = $request->hasSession() ? $request->session()->getId() : null;

        $sessions = UserSession::where('user_id', $request->user()->id)
            ->orderByDesc('last_active_at')
            ->orderByDesc('created_at')
            ->get()
            ->map(function (UserSession $session) use ($currentTokenId, $currentSessionId) {
                $isCurrent = $session->auth_type === 'browser'
                    ? $session->session_id !== null && $session->session_id === $currentSessionId
                    : $session->token_id !== null && $session->token_id === $currentTokenId;

                return [
                    'id'             => $session->id,
                    'auth_type'      => $session->auth_type,
                    'device'         => $session->auth_type === 'browser'
                        ? $this->parseBrowserDevice($session->user_agent)
                        : $this->parseTokenDevice($session->user_agent),
                    'ip_address'     => $session->ip_address,
                    'last_active_at' => $session->last_active_at?->toIso8601String(),
                    'created_at'     => $session->created_at->toIso8601String(),
                    'is_current'     => $isCurrent,
                ];
            });

        return response()->json(['data' => $sessions]);
    }

    public function destroy(Request $request, UserSession $userSession): JsonResponse
    {
        if ($userSession->user_id !== $request->user()->id) {
            abort(403);
        }

        if ($userSession->token_id) {
            $request->user()
                ->tokens()
                ->where('id', $userSession->token_id)
                ->delete();
        }

        if (
            $userSession->auth_type === 'browser'
            && $request->hasSession()
            && $userSession->session_id === $request->session()->getId()
        ) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        $userSession->delete();

        return response()->json(['message' => 'Session revoked.']);
    }

    public function destroyOthers(Request $request): JsonResponse
    {
        $currentTokenId = $request->user()->currentAccessToken()?->id;
        $currentSessionId = $request->hasSession() ? $request->session()->getId() : null;

        $others = UserSession::where('user_id', $request->user()->id)
            ->where(function ($query) use ($currentTokenId, $currentSessionId) {
                if ($currentTokenId) {
                    $query->where('token_id', '!=', $currentTokenId);
                    return;
                }

                $query->where('auth_type', '!=', 'browser')
                    ->orWhere('session_id', '!=', $currentSessionId);
            })
            ->get();

        $tokenIds = $others->pluck('token_id')->filter();

        if ($tokenIds->isNotEmpty()) {
            $request->user()->tokens()->whereIn('id', $tokenIds)->delete();
        }

        UserSession::whereIn('id', $others->pluck('id'))->delete();

        return response()->json(['message' => 'All other sessions signed out.']);
    }

    private function parseBrowserDevice(?string $userAgent): string
    {
        if (! $userAgent) {
            return 'Unknown Device';
        }

        $browser = 'Browser';
        $os = 'Unknown OS';

        if (str_contains($userAgent, 'Edg/')) {
            $browser = 'Microsoft Edge';
        } elseif (str_contains($userAgent, 'OPR/')) {
            $browser = 'Opera';
        } elseif (str_contains($userAgent, 'Firefox/')) {
            $browser = 'Firefox';
        } elseif (str_contains($userAgent, 'Chrome/')) {
            $browser = 'Chrome';
        } elseif (str_contains($userAgent, 'Safari/')) {
            $browser = 'Safari';
        }

        if (str_contains($userAgent, 'iPhone')) {
            $os = 'iPhone';
        } elseif (str_contains($userAgent, 'iPad')) {
            $os = 'iPad';
        } elseif (str_contains($userAgent, 'Android')) {
            $os = 'Android';
        } elseif (str_contains($userAgent, 'Windows NT')) {
            $os = 'Windows';
        } elseif (str_contains($userAgent, 'Macintosh')) {
            $os = 'macOS';
        } elseif (str_contains($userAgent, 'Linux')) {
            $os = 'Linux';
        }

        return "{$browser} on {$os}";
    }

    private function parseTokenDevice(?string $userAgent): string
    {
        if (! $userAgent) {
            return 'Mobile / API Client';
        }

        return $this->parseBrowserDevice($userAgent);
    }
}
