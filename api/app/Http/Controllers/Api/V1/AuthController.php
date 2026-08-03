<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AccountAccessRequest;
use App\Models\AccountInvitation;
use App\Models\AuditLog;
use App\Models\DeviceToken;
use App\Models\User;
use App\Models\UserSession;
use App\Support\PasswordPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
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

        $user = User::where('email', $data['email'])->first();

        // Always return the same response to prevent account enumeration. Only
        // active accounts receive reset links; suspended/disabled/offboarded
        // accounts must be handled through the account-lifecycle workflow.
        if ($user?->accountAllowsAuthentication()) {
            Password::sendResetLink(['email' => $data['email']]);
        }

        AuditLog::record('auth.password_reset_requested', [
            'auditable_type' => $user ? User::class : null,
            'auditable_id'   => $user?->id,
            'new_values'     => ['email' => $data['email'], 'sent' => (bool) $user?->accountAllowsAuthentication()],
            'tags'           => 'auth',
        ]);

        return response()->json([
            'message' => 'If an account with that email exists, a password reset link has been sent.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $emailForPolicy = (string) $request->input('email', '');

        $data = $request->validate([
            'token'                 => ['required', 'string'],
            'email'                 => ['required', 'email'],
            'password'              => PasswordPolicy::rules(
                null,
                ['email' => $emailForPolicy],
            ),
            'password_confirmation' => ['required', 'string'],
        ]);

        $candidate = User::where('email', $data['email'])->first();
        if (! $candidate?->accountAllowsAuthentication()) {
            AuditLog::record('auth.password_reset_failed', [
                'auditable_type' => $candidate ? User::class : null,
                'auditable_id'   => $candidate?->id,
                'new_values'     => ['reason' => $candidate?->authenticationBlockReason() ?? 'unknown_user'],
                'tags'           => 'auth',
            ]);

            return response()->json(['message' => 'This password reset link is invalid or has expired.'], 422);
        }

        $status = Password::reset(
            [
                'email' => $data['email'],
                'password' => $data['password'],
                'password_confirmation' => $data['password_confirmation'],
                'token' => $data['token'],
            ],
            function (User $user, string $password): void {
                PasswordPolicy::applyNewPassword($user, $password);

                $user->tokens()->delete();
                UserSession::where('user_id', $user->id)->delete();

                AuditLog::record('auth.password_reset_completed', [
                    'auditable_type' => User::class,
                    'auditable_id'   => $user->id,
                    'tags'           => 'auth',
                ]);
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            AuditLog::record('auth.password_reset_failed', [
                'auditable_type' => User::class,
                'auditable_id'   => $candidate->id,
                'new_values'     => ['reason' => $status],
                'tags'           => 'auth',
            ]);

            return response()->json(['message' => 'This password reset link is invalid or has expired.'], 422);
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

            $this->invalidLogin();
        }

        if (! $user->accountAllowsAuthentication()) {
            AuditLog::record('auth.login.blocked', [
                'auditable_type' => User::class,
                'auditable_id'   => $user->id,
                'new_values'     => ['reason' => $user->authenticationBlockReason()],
                'tags'           => 'auth',
            ]);

            $this->invalidLogin();
        }

        // A bcrypt (or otherwise legacy) hash can only be upgraded after the
        // plaintext password has been verified successfully.
        if (! str_starts_with((string) $user->password, '$argon2id$') || Hash::needsRehash($user->password)) {
            $user->forceFill(['password' => Hash::make((string) $request->password)])->save();
        }

        PasswordPolicy::markExpiredIfNeeded($user->fresh());
        $user->refresh();

        if ($user->mfa_enabled) {
            $code = (string) $request->input('code', '');

            if ($code === '') {
                return response()->json([
                    'message'      => 'Two-factor verification required.',
                    'mfa_required' => true,
                ]);
            }

            if (!$this->verifyTwoFactorCode($user, $code)) {
                AuditLog::record('auth.mfa.failed', [
                    'auditable_type' => User::class,
                    'auditable_id'   => $user->id,
                    'tags'           => 'auth',
                ]);

                throw ValidationException::withMessages([
                    'code' => ['Invalid or expired verification code.'],
                ]);
            }

            AuditLog::record('auth.mfa.success', [
                'auditable_type' => User::class,
                'auditable_id'   => $user->id,
                'tags'           => 'auth',
            ]);
        }

        $user->update(['last_login_at' => now()]);

        $isMobileClient = $this->isMobileClient($request);
        $canUseSessionAuth = $request->hasSession();

        if ($isMobileClient || !$canUseSessionAuth) {
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

        try {
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
        } catch (RuntimeException) {
            // Fallback for clients that present browser credentials but lack a session store context.
            $newToken = $user->createToken($request->device_name ?? 'browser-fallback');

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
            'password'              => PasswordPolicy::rules($user),
            'password_confirmation' => ['required', 'string'],
        ]);

        PasswordPolicy::applyNewPassword($user, $data['password']);

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

    public function logoutAll(Request $request): JsonResponse
    {
        $user = $request->user();

        $user->tokens()->delete();
        UserSession::where('user_id', $user->id)->delete();

        if ($request->hasSession()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        AuditLog::record('auth.logout_all', [
            'auditable_type' => User::class,
            'auditable_id'   => $user->id,
            'tags'           => 'auth',
        ]);

        return response()->json(['message' => 'Signed out from all sessions.']);
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

    public function accessRequest(Request $request): JsonResponse
    {
        $data = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'official_email' => ['required', 'email', 'max:255'],
            'position_title' => ['nullable', 'string', 'max:255'],
            'department_name' => ['nullable', 'string', 'max:255'],
            'supervisor_name' => ['nullable', 'string', 'max:255'],
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        $email = $this->normaliseEmail($data['official_email']);
        if (! $this->emailDomainAllowed($email)) {
            throw ValidationException::withMessages([
                'official_email' => ['Use an approved official SADC PF email address.'],
            ]);
        }

        $hasExistingIdentity = User::withTrashed()->where('email', $email)->exists();
        $hasPendingInvitation = AccountInvitation::where('email', $email)
            ->where('status', AccountInvitation::STATUS_PENDING)
            ->where('expires_at', '>', now())
            ->exists();
        $hasPendingRequest = AccountAccessRequest::where('official_email', $email)
            ->where('status', AccountAccessRequest::STATUS_REQUESTED)
            ->exists();

        if (! $hasExistingIdentity && ! $hasPendingInvitation && ! $hasPendingRequest) {
            AccountAccessRequest::create([
                'tenant_id' => null,
                'full_name' => trim((string) $data['full_name']),
                'official_email' => $email,
                'position_title' => $data['position_title'] ?? null,
                'department_name' => $data['department_name'] ?? null,
                'supervisor_name' => $data['supervisor_name'] ?? null,
                'reason' => $data['reason'] ?? null,
                'status' => AccountAccessRequest::STATUS_REQUESTED,
            ]);
        }

        AuditLog::record('auth.access_requested', [
            'new_values' => [
                'email' => $email,
                'recorded' => ! $hasExistingIdentity && ! $hasPendingInvitation && ! $hasPendingRequest,
            ],
            'tags' => 'auth',
        ]);

        return response()->json([
            'message' => 'If your request can be processed, further instructions will be sent to the email address provided.',
        ], 202);
    }

    public function showInvitation(string $token): JsonResponse
    {
        $invitation = $this->resolveInvitation($token);

        if (! $invitation) {
            return response()->json(['message' => 'This invitation link is invalid or has expired.'], 404);
        }

        return response()->json([
            'data' => [
                'email' => $invitation->email,
                'name' => $invitation->user?->name,
                'expires_at' => $invitation->expires_at?->toIso8601String(),
            ],
        ]);
    }

    public function activateInvitation(Request $request, string $token): JsonResponse
    {
        $invitation = $this->resolveInvitation($token);

        if (! $invitation) {
            return response()->json(['message' => 'This invitation link is invalid or has expired.'], 422);
        }

        $data = $request->validate([
            'password' => PasswordPolicy::rules($invitation->user, [
                'email' => $invitation->email,
                'name' => $invitation->user?->name,
                'employee_number' => $invitation->user?->employee_number,
            ]),
            'password_confirmation' => ['required', 'string'],
            'accepted_notices' => ['sometimes', 'accepted'],
        ]);

        DB::transaction(function () use ($invitation, $data): void {
            $lockedInvitation = AccountInvitation::whereKey($invitation->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $lockedInvitation->isUsable()) {
                throw ValidationException::withMessages([
                    'token' => ['This invitation link is invalid or has expired.'],
                ]);
            }

            $user = User::whereKey($lockedInvitation->user_id)
                ->lockForUpdate()
                ->firstOrFail();

            PasswordPolicy::applyNewPassword($user, $data['password'], [
                'is_active' => true,
                'account_status' => User::STATUS_ACTIVE,
                'email_verified_at' => now(),
                'setup_completed' => false,
                'activated_at' => now(),
                'status_changed_at' => now(),
                'status_reason' => null,
            ]);

            $lockedInvitation->forceFill([
                'status' => AccountInvitation::STATUS_ACCEPTED,
                'accepted_at' => now(),
            ])->save();

            AccountInvitation::where('user_id', $user->id)
                ->where('id', '!=', $lockedInvitation->id)
                ->where('status', AccountInvitation::STATUS_PENDING)
                ->update([
                    'status' => AccountInvitation::STATUS_SUPERSEDED,
                    'superseded_by_id' => $lockedInvitation->id,
                ]);

            AuditLog::record('auth.invitation_accepted', [
                'auditable_type' => User::class,
                'auditable_id' => $user->id,
                'new_values' => ['invitation_id' => $lockedInvitation->id],
                'tags' => 'auth',
            ]);
        });

        return response()->json([
            'message' => 'Account activated. You can now sign in.',
        ]);
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

    private function invalidLogin(): never
    {
        throw ValidationException::withMessages([
            'email' => ['The email, password, or authentication information provided is invalid.'],
        ]);
    }

    private function resolveInvitation(string $token): ?AccountInvitation
    {
        $invitation = AccountInvitation::query()
            ->where('token_hash', AccountInvitation::hashToken($token))
            ->with('user')
            ->first();

        if (! $invitation) {
            return null;
        }

        if ($invitation->status === AccountInvitation::STATUS_PENDING && $invitation->expires_at?->isPast()) {
            $invitation->forceFill(['status' => AccountInvitation::STATUS_EXPIRED])->save();
            return null;
        }

        if (! $invitation->isUsable()) {
            return null;
        }

        return $invitation;
    }

    private function normaliseEmail(string $email): string
    {
        return strtolower(trim($email));
    }

    private function emailDomainAllowed(string $email): bool
    {
        $allowedDomains = config('auth_lifecycle.allowed_email_domains', []);
        if ($allowedDomains === []) {
            return true;
        }

        $domain = strtolower((string) strrchr($email, '@'));
        $domain = ltrim($domain, '@');

        return in_array($domain, $allowedDomains, true);
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
