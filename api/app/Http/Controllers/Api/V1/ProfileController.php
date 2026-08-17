<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\UserSession;
use App\Support\PasswordPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class ProfileController extends Controller
{
    public function show(Request $request)
    {
        return $request->user()->load('department', 'portfolios');
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:20',
            'bio' => 'nullable|string',
            'nationality' => 'nullable|string|max:100',
            'gender' => 'nullable|string|max:20',
            'marital_status' => 'nullable|string|max:20',
            'emergency_contact_name' => 'nullable|string|max:255',
            'emergency_contact_relationship' => 'nullable|string|max:100',
            'emergency_contact_phone' => 'nullable|string|max:20',
            'address_line1' => 'nullable|string|max:255',
            'address_line2' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
            'skills' => 'nullable|array',
            'qualifications' => 'nullable|array',
        ]);

        $user->update($validated);

        return response()->json($user->load('department', 'portfolios'));
    }

    /**
     * Persist the user's inactivity sign-out preference.
     * 0 = never; null on the user row means platform default (SESSION_LIFETIME).
     */
    public function updateIdleTimeout(Request $request): JsonResponse
    {
        $data = $request->validate([
            'idle_timeout_minutes' => ['required', 'integer', 'in:0,15,30,60,120,480'],
        ]);

        $request->user()->update([
            'idle_timeout_minutes' => $data['idle_timeout_minutes'],
        ]);

        AuditLog::record('auth.idle_timeout_updated', [
            'auditable_type' => \App\Models\User::class,
            'auditable_id'   => $request->user()->id,
            'tags'           => 'auth',
            'new_values'     => ['idle_timeout_minutes' => $data['idle_timeout_minutes']],
        ]);

        return response()->json([
            'data' => [
                'idle_timeout_minutes' => (int) $request->user()->fresh()->idle_timeout_minutes,
            ],
        ]);
    }

    /**
     * Change authenticated user's password.
     */
    public function updatePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => 'required|string',
            'password' => PasswordPolicy::rules($request->user()),
        ], [
            'password.confirmed' => 'The new password confirmation does not match.',
        ]);

        $user = $request->user();

        if (! PasswordPolicy::check((string) $request->current_password, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        PasswordPolicy::applyNewPassword($user, (string) $request->password);

        $this->revokeOtherAccess($request);

        AuditLog::record('auth.password_changed', [
            'auditable_type' => \App\Models\User::class,
            'auditable_id' => $user->id,
            'tags' => 'auth',
        ]);

        return response()->json(['message' => 'Password changed successfully.']);
    }

    private function revokeOtherAccess(Request $request): void
    {
        $user = $request->user();
        $currentToken = $user->currentAccessToken();
        $currentTokenId = $currentToken instanceof PersonalAccessToken
            ? $currentToken->getKey()
            : null;
        $currentSessionId = $request->hasSession() ? $request->session()->getId() : null;

        if ($currentTokenId) {
            $user->tokens()->where('id', '!=', $currentTokenId)->delete();
            UserSession::where('user_id', $user->id)
                ->where(function ($query) use ($currentTokenId) {
                    $query->whereNull('token_id')->orWhere('token_id', '!=', $currentTokenId);
                })
                ->delete();

            return;
        }

        $user->tokens()->delete();

        UserSession::where('user_id', $user->id)
            ->where(function ($query) use ($currentSessionId) {
                $query->where('auth_type', '!=', 'browser')
                    ->orWhere('session_id', '!=', $currentSessionId);
            })
            ->delete();
    }
}
