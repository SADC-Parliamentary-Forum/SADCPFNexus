<?php

namespace App\Http\Controllers\Api\V1\Profile;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\UserSession;
use App\Support\PasswordPolicy;
use App\Support\SecondFactor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;
use PragmaRX\Google2FA\Google2FA;

class TwoFactorController extends Controller
{
    private Google2FA $google2fa;

    public function __construct()
    {
        $this->google2fa = new Google2FA;
    }

    /**
     * GET /profile/2fa/status
     * Returns whether 2FA is currently enabled.
     */
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'enabled' => (bool) $user->mfa_enabled,
            'recovery_codes_remaining' => $user->mfa_enabled ? SecondFactor::remainingRecoveryCodes($user) : 0,
        ]);
    }

    /**
     * POST /profile/2fa/enable
     * Generates a new TOTP secret and returns the QR code URI.
     * Does NOT enable 2FA yet — caller must confirm with a valid code.
     */
    public function enable(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->mfa_enabled) {
            return response()->json(['message' => '2FA is already enabled.'], 422);
        }

        $secret = $this->google2fa->generateSecretKey();

        // Store temporarily (not confirmed yet)
        $user->update(['mfa_secret' => $secret, 'mfa_enabled' => false]);

        AuditLog::record('auth.mfa_setup_started', [
            'auditable_type' => \App\Models\User::class,
            'auditable_id' => $user->id,
            'tags' => 'auth',
        ]);

        $qrCodeUrl = $this->google2fa->getQRCodeUrl(
            config('app.name', 'SADCPFNexus'),
            $user->email,
            $secret
        );

        return response()->json([
            'secret' => $secret,
            'qr_code_url' => $qrCodeUrl,
        ]);
    }

    /**
     * POST /profile/2fa/confirm
     * Verifies a TOTP code and activates 2FA if correct.
     */
    public function confirm(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'digits:6'],
        ]);

        $user = $request->user();

        if (! $user->mfa_secret) {
            return response()->json(['message' => 'No 2FA setup in progress. Call /enable first.'], 422);
        }

        $valid = $this->google2fa->verifyKey($user->mfa_secret, $data['code']);

        if (! $valid) {
            AuditLog::record('auth.mfa_setup_failed', [
                'auditable_type' => \App\Models\User::class,
                'auditable_id' => $user->id,
                'tags' => 'auth',
            ]);

            throw ValidationException::withMessages(['code' => ['Invalid or expired code. Please try again.']]);
        }

        $user->update(['mfa_enabled' => true]);
        $recoveryCodes = SecondFactor::regenerateRecoveryCodes($user);

        AuditLog::record('auth.mfa_registered', [
            'auditable_type' => \App\Models\User::class,
            'auditable_id' => $user->id,
            'tags' => 'auth',
        ]);

        return response()->json([
            'message' => '2FA enabled successfully.',
            'enabled' => true,
            // Shown once; only hashes are stored.
            'recovery_codes' => $recoveryCodes,
        ]);
    }

    /**
     * POST /profile/2fa/disable
     * Disables 2FA after verifying the password AND a current authenticator
     * code (or an unused recovery code) — a stolen session plus password
     * alone must not be enough to remove the second factor.
     */
    public function disable(Request $request): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', 'string'],
            'code' => ['required', 'string', 'max:32'],
        ]);

        $user = $request->user();

        if (! PasswordPolicy::check((string) $data['password'], $user->password)) {
            throw ValidationException::withMessages(['password' => ['Incorrect password.']]);
        }

        if ($user->mfa_enabled && SecondFactor::verify($user, (string) $data['code']) === null) {
            AuditLog::record('auth.mfa.failed', [
                'auditable_type' => \App\Models\User::class,
                'auditable_id' => $user->id,
                'tags' => 'auth',
            ]);

            throw ValidationException::withMessages(['code' => ['Invalid authenticator or recovery code.']]);
        }

        $user->update(['mfa_enabled' => false, 'mfa_secret' => null, 'mfa_recovery_codes' => null]);
        $this->revokeOtherAccess($request);

        AuditLog::record('auth.mfa_disabled', [
            'auditable_type' => \App\Models\User::class,
            'auditable_id' => $user->id,
            'tags' => 'auth',
        ]);

        return response()->json(['message' => '2FA disabled.', 'enabled' => false]);
    }

    /**
     * POST /profile/2fa/recovery-codes
     * Replaces all recovery codes. Requires the password and a current
     * authenticator code (not a recovery code).
     */
    public function regenerateRecoveryCodes(Request $request): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', 'string'],
            'code' => ['required', 'string', 'digits:6'],
        ]);

        $user = $request->user();

        if (! $user->mfa_enabled) {
            return response()->json(['message' => '2FA is not enabled.'], 422);
        }
        if (! PasswordPolicy::check((string) $data['password'], $user->password)) {
            throw ValidationException::withMessages(['password' => ['Incorrect password.']]);
        }
        if (! SecondFactor::verifyTotp($user, (string) $data['code'])) {
            throw ValidationException::withMessages(['code' => ['Invalid or expired verification code.']]);
        }

        $codes = SecondFactor::regenerateRecoveryCodes($user);

        AuditLog::record('auth.mfa_recovery_codes_regenerated', [
            'auditable_type' => \App\Models\User::class,
            'auditable_id' => $user->id,
            'tags' => 'auth',
        ]);

        return response()->json(['recovery_codes' => $codes]);
    }

    /**
     * POST /profile/2fa/verify
     * Used during login flow to verify a TOTP code for a user with 2FA enabled.
     */
    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'digits:6'],
        ]);

        $user = $request->user();

        if (! $user->mfa_enabled || ! $user->mfa_secret) {
            return response()->json(['message' => '2FA is not enabled.', 'valid' => false], 422);
        }

        if (! SecondFactor::verifyTotp($user, (string) $data['code'])) {
            AuditLog::record('auth.mfa.failed', [
                'auditable_type' => \App\Models\User::class,
                'auditable_id' => $user->id,
                'tags' => 'auth',
            ]);

            throw ValidationException::withMessages(['code' => ['Invalid or expired verification code.']]);
        }

        AuditLog::record('auth.mfa.success', [
            'auditable_type' => \App\Models\User::class,
            'auditable_id' => $user->id,
            'tags' => 'auth',
        ]);

        return response()->json(['message' => 'Code verified.', 'valid' => true]);
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
