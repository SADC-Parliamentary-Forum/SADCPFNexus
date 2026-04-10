<?php

namespace App\Http\Controllers\Api\V1\Profile;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use PragmaRX\Google2FA\Google2FA;

class TwoFactorController extends Controller
{
    private Google2FA $google2fa;

    public function __construct()
    {
        $this->google2fa = new Google2FA();
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

        $qrCodeUrl = $this->google2fa->getQRCodeUrl(
            config('app.name', 'SADCPFNexus'),
            $user->email,
            $secret
        );

        return response()->json([
            'secret'      => $secret,
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

        if (!$user->mfa_secret) {
            return response()->json(['message' => 'No 2FA setup in progress. Call /enable first.'], 422);
        }

        $valid = $this->google2fa->verifyKey($user->mfa_secret, $data['code']);

        if (!$valid) {
            throw ValidationException::withMessages(['code' => ['Invalid or expired code. Please try again.']]);
        }

        $user->update(['mfa_enabled' => true]);

        return response()->json(['message' => '2FA enabled successfully.', 'enabled' => true]);
    }

    /**
     * POST /profile/2fa/disable
     * Disables 2FA after verifying the user's password.
     */
    public function disable(Request $request): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', 'string'],
        ]);

        $user = $request->user();

        if (!Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['password' => ['Incorrect password.']]);
        }

        $user->update(['mfa_enabled' => false, 'mfa_secret' => null]);

        return response()->json(['message' => '2FA disabled.', 'enabled' => false]);
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

        if (!$user->mfa_enabled || !$user->mfa_secret) {
            return response()->json(['message' => '2FA is not enabled.', 'valid' => false], 422);
        }

        $valid = $this->google2fa->verifyKey($user->mfa_secret, $data['code']);

        if (!$valid) {
            throw ValidationException::withMessages(['code' => ['Invalid or expired verification code.']]);
        }

        return response()->json(['message' => 'Code verified.', 'valid' => true]);
    }
}
