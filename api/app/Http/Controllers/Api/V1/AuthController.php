<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\DeviceToken;
use App\Models\User;
use App\Models\UserSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * @OA\Post(
     *     path="/api/v1/auth/login",
     *     summary="Authenticate user and issue Sanctum token",
     *     tags={"Auth"},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"email","password"},
     *             @OA\Property(property="email", type="string", format="email"),
     *             @OA\Property(property="password", type="string", format="password"),
     *             @OA\Property(property="device_name", type="string")
     *         )
     *     ),
     *     @OA\Response(response=200, description="Token issued"),
     *     @OA\Response(response=422, description="Invalid credentials")
     * )
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email'       => ['required', 'email'],
            'password'    => ['required'],
            'device_name' => ['nullable', 'string', 'max:255'],
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

        $user->update(['last_login_at' => now()]);

        $newToken = $user->createToken($request->device_name ?? 'web');
        $token    = $newToken->plainTextToken;

        UserSession::create([
            'user_id'        => $user->id,
            'token_id'       => $newToken->accessToken->id,
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
            'token' => $token,
            'user'  => [
                'id'                   => $user->id,
                'name'                 => $user->name,
                'email'                => $user->email,
                'tenant_id'            => $user->tenant_id,
                'vendor_id'            => $user->vendor_id,
                'classification'       => $user->classification,
                'must_reset_password'  => (bool) $user->must_reset_password,
                'setup_completed'      => (bool) $user->setup_completed,
                'roles'                => $user->getRoleNames(),
                'permissions'          => $user->getAllPermissions()->pluck('name'),
            ],
        ]);
    }

    /**
     * Force-reset the authenticated user's password on first login.
     * Only permitted when must_reset_password = true.
     * Does not require the old password.
     */
    public function forceResetPassword(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->must_reset_password) {
            return response()->json(['message' => 'Password reset not required.'], 403);
        }

        $data = $request->validate([
            'password'              => ['required', 'string', 'min:8', 'confirmed'],
            'password_confirmation' => ['required', 'string'],
        ]);

        $user->update([
            'password'             => \Illuminate\Support\Facades\Hash::make($data['password']),
            'must_reset_password'  => false,
        ]);

        AuditLog::record('auth.password_force_reset', [
            'auditable_type' => User::class,
            'auditable_id'   => $user->id,
            'tags'           => 'auth',
        ]);

        return response()->json(['message' => 'Password updated successfully.']);
    }

    /**
     * @OA\Post(
     *     path="/api/v1/auth/logout",
     *     summary="Revoke current token",
     *     tags={"Auth"},
     *     security={{"sanctum":{}}},
     *     @OA\Response(response=200, description="Logged out")
     * )
     */
    public function logout(Request $request): JsonResponse
    {
        $tokenId = $request->user()->currentAccessToken()->id;
        UserSession::where('token_id', $tokenId)->delete();
        $request->user()->currentAccessToken()->delete();

        AuditLog::record('auth.logout', [
            'auditable_type' => User::class,
            'auditable_id'   => $request->user()->id,
            'tags'           => 'auth',
        ]);

        return response()->json(['message' => 'Logged out successfully']);
    }

    /**
     * @OA\Get(
     *     path="/api/v1/auth/me",
     *     summary="Get authenticated user profile",
     *     tags={"Auth"},
     *     security={{"sanctum":{}}},
     *     @OA\Response(response=200, description="User profile")
     * )
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('tenant', 'department');

        return response()->json([
            'id'             => $user->id,
            'name'           => $user->name,
            'email'          => $user->email,
            'tenant_id'      => $user->tenant_id,
            'vendor_id'      => $user->vendor_id,
            'employee_number'=> $user->employee_number,
            'job_title'      => $user->job_title,
            'tenant'         => $user->tenant,
            'department'     => $user->department,
            'classification'       => $user->classification,
            'mfa_enabled'         => $user->mfa_enabled,
            'must_reset_password' => (bool) $user->must_reset_password,
            'setup_completed'     => (bool) $user->setup_completed,
            'roles'               => $user->getRoleNames(),
            'permissions'         => $user->getAllPermissions()->pluck('name'),
        ]);
    }

    /**
     * Register (or refresh) an FCM device token for push notifications.
     * Called by the mobile app after login and on token refresh.
     */
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

    /**
     * Remove a specific FCM device token (called on logout from mobile).
     */
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
}
