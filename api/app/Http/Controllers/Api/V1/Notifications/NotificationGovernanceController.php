<?php

namespace App\Http\Controllers\Api\V1\Notifications;

use App\Http\Controllers\Controller;
use App\Models\Notifications\NotificationGovernanceDecision;
use App\Modules\Notifications\Services\GovernanceChecklistService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationGovernanceController extends Controller
{
    public function __construct(
        private readonly GovernanceChecklistService $checklist,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $rows = $this->checklist->listForTenant((int) $request->user()->tenant_id);

        return response()->json([
            'data' => $rows,
            'meta' => [
                'channel_status' => $this->checklist->channelGovernanceStatus(),
                'prd_section' => 124,
                'note' => 'All items default to Pending. Do not invent institutional answers in code.',
            ],
        ]);
    }

    public function update(Request $request, NotificationGovernanceDecision $decision): JsonResponse
    {
        $this->authorizeAdmin($request);
        $this->assertTenant($request, (int) $decision->tenant_id);

        $data = $request->validate([
            'status' => ['required', 'string', 'in:pending,decided,not_applicable'],
            'decision_notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $updated = $this->checklist->update($request->user(), $decision, $data);

        return response()->json([
            'message' => 'Governance decision updated.',
            'data' => $updated,
        ]);
    }

    private function authorizeAdmin(Request $request): void
    {
        $user = $request->user();
        if (
            $user->can('notifications.admin')
            || $user->can('notifications.manage-policies')
            || $user->can('notifications.manage-providers')
            || $user->isSystemAdmin()
        ) {
            return;
        }
        abort(403);
    }

    private function assertTenant(Request $request, int $tenantId): void
    {
        if ((int) $request->user()->tenant_id !== (int) $tenantId) {
            abort(404);
        }
    }
}
