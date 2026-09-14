<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Modules\Procurement\Services\SupplierEmailVerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierEmailVerificationController extends Controller
{
    public function __construct(
        private readonly SupplierEmailVerificationService $verification,
    ) {}

    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user' => ['required', 'integer'],
            'expires' => ['required', 'integer'],
            'signature' => ['required', 'string'],
        ]);

        $user = $this->verification->verify((int) $data['user'], (int) $data['expires'], $data['signature']);

        return response()->json([
            'message' => 'Email verified. You can now complete and submit your supplier application.',
            'data' => [
                'user_id' => $user->id,
                'vendor_id' => $user->vendor_id,
                'email_verified' => true,
            ],
        ]);
    }

    public function resend(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->isSupplier(), 403);

        if ($user->email_verified_at) {
            return response()->json(['message' => 'Email is already verified.']);
        }

        $this->verification->send($user);

        return response()->json(['message' => 'Verification email sent.']);
    }
}
