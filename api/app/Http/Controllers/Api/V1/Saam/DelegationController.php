<?php

namespace App\Http\Controllers\Api\V1\Saam;

use App\Http\Controllers\Controller;
use App\Models\DelegatedAuthority;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DelegationController extends Controller
{
    private function checkPerm(Request $request): void
    {
        $user = $request->user();
        if (!$user->isSystemAdmin()) {
            abort_unless($user->hasPermissionTo('saam.delegate', 'sanctum'), 403);
        }
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $outgoing = DelegatedAuthority::where('principal_user_id', $user->id)
            ->where('tenant_id', $user->tenant_id)
            ->with(['delegate:id,name,email,job_title', 'creator:id,name'])
            ->orderByDesc('created_at')
            ->get();

        $incoming = DelegatedAuthority::where('delegate_user_id', $user->id)
            ->where('tenant_id', $user->tenant_id)
            ->with(['principal:id,name,email,job_title', 'creator:id,name'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => [
                'outgoing' => $outgoing,
                'incoming' => $incoming,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->checkPerm($request);

        $data = $request->validate([
            'delegate_user_id' => ['required', 'integer', 'exists:users,id'],
            'start_date'       => ['required', 'date', 'after_or_equal:today'],
            'end_date'         => ['required', 'date', 'after_or_equal:start_date'],
            'role_scope'       => ['nullable', 'string', 'max:128'],
            'reason'           => ['nullable', 'string', 'max:1000'],
        ]);

        $user = $request->user();

        if ((int) $data['delegate_user_id'] === (int) $user->id) {
            return response()->json(['message' => 'You cannot delegate authority to yourself.'], 422);
        }

        $delegation = DelegatedAuthority::create([
            'tenant_id'         => $user->tenant_id,
            'principal_user_id' => $user->id,
            'delegate_user_id'  => $data['delegate_user_id'],
            'start_date'        => $data['start_date'],
            'end_date'          => $data['end_date'],
            'role_scope'        => $data['role_scope'] ?? null,
            'reason'            => $data['reason'] ?? null,
            'created_by'        => $user->id,
        ]);

        return response()->json([
            'message' => 'Delegation created.',
            'data'    => $delegation->load(['delegate:id,name,email', 'principal:id,name']),
        ], 201);
    }

    public function destroy(Request $request, DelegatedAuthority $delegation): JsonResponse
    {
        $user = $request->user();

        // Only the principal or a system admin can revoke
        if ((int) $delegation->principal_user_id !== (int) $user->id && !$user->isSystemAdmin()) {
            abort(403);
        }

        abort_unless((int) $delegation->tenant_id === (int) $user->tenant_id, 404);

        // Revoke by backdating end_date to yesterday
        $delegation->update(['end_date' => now()->subDay()->toDateString()]);

        return response()->json(['message' => 'Delegation revoked.']);
    }
}
