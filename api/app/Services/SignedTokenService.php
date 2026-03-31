<?php

namespace App\Services;

use App\Exceptions\TokenExpiredException;
use App\Exceptions\TokenUsedException;
use App\Models\ApprovalRequest;
use App\Models\SignedActionToken;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;

class SignedTokenService
{
    /**
     * Create an approve + reject token pair for the given approver.
     *
     * Returns an associative array with 'approve_url' and 'reject_url' keys.
     */
    public function createPair(ApprovalRequest $request, User $approver): array
    {
        $approveToken = bin2hex(random_bytes(32)); // 64-char hex, 256-bit entropy
        $rejectToken  = bin2hex(random_bytes(32));
        $expiresAt    = now()->addHours(72);

        SignedActionToken::insert([
            [
                'tenant_id'           => $approver->tenant_id,
                'approval_request_id' => $request->id,
                'approver_user_id'    => $approver->id,
                'token'               => $approveToken,
                'action'              => 'approve',
                'expires_at'          => $expiresAt,
                'used_at'             => null,
                'created_at'          => now(),
                'updated_at'          => now(),
            ],
            [
                'tenant_id'           => $approver->tenant_id,
                'approval_request_id' => $request->id,
                'approver_user_id'    => $approver->id,
                'token'               => $rejectToken,
                'action'              => 'reject',
                'expires_at'          => $expiresAt,
                'used_at'             => null,
                'created_at'          => now(),
                'updated_at'          => now(),
            ],
        ]);

        $frontendBase = rtrim(env('FRONTEND_URL', 'http://localhost:3000'), '/');

        return [
            'approve_url' => $frontendBase . '/approval?action=approve&token=' . $approveToken,
            'reject_url'  => $frontendBase . '/approval?action=reject&token=' . $rejectToken,
        ];
    }

    /**
     * Validate and atomically consume a token.
     *
     * Returns the SignedActionToken with approvalRequest (+ approvable) and approver loaded.
     *
     * @throws ModelNotFoundException   If token not found
     * @throws TokenExpiredException    If token has expired
     * @throws TokenUsedException       If token was already consumed
     * @throws \InvalidArgumentException If token action doesn't match expected action
     */
    public function consume(string $token, string $expectedAction): SignedActionToken
    {
        return DB::transaction(function () use ($token, $expectedAction) {
            /** @var SignedActionToken $record */
            $record = SignedActionToken::where('token', $token)
                ->lockForUpdate()
                ->firstOrFail();

            if ($record->action !== $expectedAction) {
                throw new \InvalidArgumentException('Token action mismatch.');
            }

            if ($record->isExpired()) {
                throw new TokenExpiredException();
            }

            if ($record->isUsed()) {
                throw new TokenUsedException();
            }

            $record->update(['used_at' => now()]);

            return $record->load(['approvalRequest.approvable', 'approver']);
        });
    }

    /**
     * Peek at a token to verify it is valid (unused + not expired) without consuming it.
     * Used for rendering the reject form page before the user submits the reason.
     *
     * @throws ModelNotFoundException
     * @throws TokenExpiredException
     * @throws TokenUsedException
     */
    public function peek(string $token): SignedActionToken
    {
        $record = SignedActionToken::where('token', $token)->firstOrFail();

        if ($record->isExpired()) {
            throw new TokenExpiredException();
        }

        if ($record->isUsed()) {
            throw new TokenUsedException();
        }

        return $record;
    }
}
