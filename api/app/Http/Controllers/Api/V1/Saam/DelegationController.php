<?php

namespace App\Http\Controllers\Api\V1\Saam;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\DelegatedAuthority;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DelegationController extends Controller
{
    public function __construct(private readonly NotificationService $notificationService) {}

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
            'module'           => ['nullable', 'string', 'max:64'],
            'can_draft'        => ['sometimes', 'boolean'],
            'can_submit'       => ['sometimes', 'boolean'],
            'can_upload'       => ['sometimes', 'boolean'],
            'can_act_on_behalf'=> ['sometimes', 'boolean'],
            'requires_principal_confirmation' => ['sometimes', 'boolean'],
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
            'module'            => $data['module'] ?? null,
            'can_draft'         => $data['can_draft'] ?? true,
            'can_submit'        => $data['can_submit'] ?? true,
            'can_upload'        => $data['can_upload'] ?? true,
            'can_act_on_behalf' => $data['can_act_on_behalf'] ?? false,
            'requires_principal_confirmation' => $data['requires_principal_confirmation'] ?? false,
            'reason'            => $data['reason'] ?? null,
            'created_by'        => $user->id,
        ]);

        AuditLog::record('delegation.created', [
            'auditable_type' => DelegatedAuthority::class,
            'auditable_id'   => $delegation->id,
            'new_values'     => $delegation->only([
                'principal_user_id', 'delegate_user_id', 'module', 'start_date', 'end_date',
                'can_draft', 'can_submit', 'can_upload', 'can_act_on_behalf',
            ]),
            'tags' => ['delegation'],
        ]);

        // If the delegation is active today, notify the delegate immediately.
        if ($delegation->isActive()) {
            $this->notifyDelegationActivated($delegation);
            $delegation->update(['activated_notified_at' => now()]);
        }

        app(\App\Modules\PeopleAuthority\Services\DelegationCollapseService::class)->mirror($delegation->fresh());

        return response()->json([
            'message' => 'Delegation created.',
            'data'    => $delegation->load(['delegate:id,name,email,job_title', 'principal:id,name']),
        ], 201);
    }

    private function notifyDelegationActivated(DelegatedAuthority $delegation): void
    {
        try {
            $delegation->loadMissing(['delegate', 'principal']);
            if (!$delegation->delegate) {
                return;
            }
            $this->notificationService->dispatch(
                $delegation->delegate,
                'delegation.activated',
                [
                    'name'       => $delegation->delegate->name,
                    'principal'  => $delegation->principal?->name ?? 'a colleague',
                    'module'     => $delegation->module ?? 'all modules',
                    'start_date' => optional($delegation->start_date)->toDateString(),
                    'end_date'   => optional($delegation->end_date)->toDateString(),
                ],
                ['module' => 'saam', 'record_id' => $delegation->id, 'url' => '/saam/delegations'],
                false
            );
        } catch (\Throwable) {
            // Notifications must never block delegation creation.
        }
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
