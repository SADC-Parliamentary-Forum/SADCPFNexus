<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\DeviceToken;
use App\Models\User;
use App\Models\UserSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;
use PragmaRX\Google2FA\Google2FA;

class AuthController extends Controller
{
    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $status = Password::sendResetLink(['email' => $data['email']]);

        if ($status !== Password::RESET_LINK_SENT) {
            return response()->json(['message' => __($status)], 422);
        }

        return response()->json([
            'message' => 'If an account with that email exists, a password reset link has been sent.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token'                 => ['required', 'string'],
            'email'                 => ['required', 'email'],
            'password'              => ['required', 'string', 'min:8', 'confirmed'],
            'password_confirmation' => ['required', 'string'],
        ]);

        $status = Password::reset(
            [
                'email' => $data['email'],
                'password' => $data['password'],
                'password_confirmation' => $data['password_confirmation'],
                'token' => $data['token'],
            ],
            function (User $user, string $password): void {
                $user->forceFill([
                    'password' => Hash::make($password),
                    'must_reset_password' => false,
                    'remember_token' => \Illuminate\Support\Str::random(60),
                ])->save();

                $user->tokens()->delete();
                UserSession::where('user_id', $user->id)->delete();
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json(['message' => __($status)], 422);
        }

        return response()->json(['message' => 'Password reset successful. You can now sign in.']);
    }

    public function login(Request $request): JsonResponse
    {
        // Empty JSON string for optional `code` is not reliably treated as NULL by validators;
        // strip it before rules run so MFA step / browser autofill quirks do not 422.
        if ($request->input('code') === '') {
            $request->merge(['code' => null]);
        }

        $request->validate([
            'email'       => ['required', 'email'],
            'password'    => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:255'],
            'client_type' => ['nullable', 'string', 'in:browser,mobile'],
            'code'        => ['nullable', 'string', 'digits:6'],
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            AuditLog::record('auth.login.failed', [
                'new_values' => ['email' => $request->email],
                'tags'       => 'auth',
            ]);

            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (!$user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['This account has been deactivated.'],
            ]);
        }

        if ($user->mfa_enabled) {
            $code = (string) $request->input('code', '');

            if ($code === '') {
                return response()->json([
                    'message'      => 'Two-factor verification required.',
                    'mfa_required' => true,
                ]);
            }

            if (!$this->verifyTwoFactorCode($user, $code)) {
                throw ValidationException::withMessages([
                    'code' => ['Invalid or expired verification code.'],
                ]);
            }
        }

        $user->update(['last_login_at' => now()]);

        if ($this->isMobileClient($request)) {
            $newToken = $user->createToken($request->device_name ?? 'mobile');

            UserSession::create([
                'user_id'        => $user->id,
                'token_id'       => $newToken->accessToken->id,
                'session_id'     => null,
                'auth_type'      => 'token',
                'ip_address'     => $request->ip(),
                'user_agent'     => $request->userAgent(),
                'last_active_at' => now(),
            ]);

            AuditLog::record('auth.login.success', [
                'auditable_type' => User::class,
                'auditable_id'   => $user->id,
                'tags'           => 'auth',
            ]);

            return response()->json([
                'token' => $newToken->plainTextToken,
                'user'  => $this->serializeUser($user),
            ]);
        }

        Auth::guard('web')->login($user);
        $request->session()->regenerate();
        $request->session()->regenerateToken();

        UserSession::updateOrCreate(
            [
                'user_id'    => $user->id,
                'session_id' => $request->session()->getId(),
                'auth_type'  => 'browser',
            ],
            [
                'token_id'       => null,
                'ip_address'     => $request->ip(),
                'user_agent'     => $request->userAgent(),
                'last_active_at' => now(),
            ]
        );

        AuditLog::record('auth.login.success', [
            'auditable_type' => User::class,
            'auditable_id'   => $user->id,
            'tags'           => 'auth',
        ]);

        return response()->json([
            'user' => $this->serializeUser($user),
        ]);
    }

    public function forceResetPassword(Request $request): JsonResponse
    {
        $user = $request->user();
        $currentToken = $user->currentAccessToken();
        $currentTokenId = $currentToken instanceof PersonalAccessToken
            ? $currentToken->getKey()
            : null;
        $currentSessionId = $request->hasSession() ? $request->session()->getId() : null;

        if (! $user->must_reset_password) {
            return response()->json(['message' => 'Password reset not required.'], 403);
        }

        $data = $request->validate([
            'password'              => ['required', 'string', 'min:8', 'confirmed'],
            'password_confirmation' => ['required', 'string'],
        ]);

        $user->update([
            'password'            => Hash::make($data['password']),
            'must_reset_password' => false,
        ]);

        if ($currentTokenId) {
            $user->tokens()->where('id', '!=', $currentTokenId)->delete();
        } else {
            $user->tokens()->delete();
        }

        UserSession::where('user_id', $user->id)
            ->where(function ($query) use ($currentTokenId, $currentSessionId) {
                if ($currentTokenId) {
                    $query->where('token_id', '!=', $currentTokenId);
                    return;
                }

                $query->where('auth_type', '!=', 'browser')
                    ->orWhere('session_id', '!=', $currentSessionId);
            })
            ->delete();

        AuditLog::record('auth.password_force_reset', [
            'auditable_type' => User::class,
            'auditable_id'   => $user->id,
            'tags'           => 'auth',
        ]);

        return response()->json(['message' => 'Password updated successfully.']);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        $currentToken = $user->currentAccessToken();

        if ($currentToken instanceof PersonalAccessToken) {
            $tokenId = $currentToken->getKey();
            UserSession::where('user_id', $user->id)
                ->where('token_id', $tokenId)
                ->delete();
            $currentToken->delete();
        } elseif ($request->hasSession()) {
            $sessionId = $request->session()->getId();

            UserSession::where('user_id', $user->id)
                ->where('auth_type', 'browser')
                ->where('session_id', $sessionId)
                ->delete();

            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        AuditLog::record('auth.logout', [
            'auditable_type' => User::class,
            'auditable_id'   => $user->id,
            'tags'           => 'auth',
        ]);

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('tenant', 'department');

        return response()->json($this->serializeUser($user) + [
            'employee_number' => $user->employee_number,
            'job_title'       => $user->job_title,
            'tenant'          => $user->tenant,
            'department'      => $user->department,
        ]);
    }

    public function registerDeviceToken(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token'       => ['required', 'string', 'max:512'],
            'platform'    => ['nullable', 'string', 'in:android,ios,web'],
            'device_name' => ['nullable', 'string', 'max:255'],
        ]);

        $user = $request->user();

        DeviceToken::register(
            userId:     $user->id,
            tenantId:   $user->tenant_id,
            token:      $data['token'],
            platform:   $data['platform']    ?? 'android',
            deviceName: $data['device_name'] ?? null,
        );

        return response()->json(['message' => 'Device token registered.']);
    }

    public function unregisterDeviceToken(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
        ]);

        DeviceToken::where('user_id', $request->user()->id)
            ->where('token', $data['token'])
            ->delete();

        return response()->json(['message' => 'Device token removed.']);
    }

    private function isMobileClient(Request $request): bool
    {
        if ($request->input('client_type') === 'mobile') {
            return true;
        }

        return in_array(strtolower((string) $request->input('device_name')), [
            'mobile',
            'android',
            'ios',
        ], true);
    }

    private function verifyTwoFactorCode(User $user, string $code): bool
    {
        if (! $user->mfa_secret) {
            return false;
        }

        return (new Google2FA())->verifyKey($user->mfa_secret, $code);
    }

    private function serializeUser(User $user): array
    {
        return [
            'id'                  => $user->id,
            'name'                => $user->name,
            'email'               => $user->email,
            'tenant_id'           => $user->tenant_id,
            'vendor_id'           => $user->vendor_id,
            'classification'      => $user->classification,
            'mfa_enabled'         => (bool) $user->mfa_enabled,
            'must_reset_password' => (bool) $user->must_reset_password,
            'setup_completed'     => (bool) $user->setup_completed,
            'roles'               => $user->getRoleNames(),
            'permissions'         => $user->getAllPermissions()->pluck('name'),
        ];
    }
}
