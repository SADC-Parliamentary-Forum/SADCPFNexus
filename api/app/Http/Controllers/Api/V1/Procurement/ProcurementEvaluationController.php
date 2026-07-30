<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\AccessControl\UserPermissionGrant;
use App\Models\ProcurementRequest;
use App\Modules\AccessControl\Services\PolicyDecisionPoint;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Feature-only procurement evaluations (PRD §10.2 / §13.7).
 * Committee members may list/score only assigned records — never the procurement module.
 */
class ProcurementEvaluationController extends Controller
{
    public function __construct(private readonly PolicyDecisionPoint $pdp) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->pdp->assert($user, 'procurement.evaluation.read.assigned', null, ['assigned' => true]);

        $specificIds = UserPermissionGrant::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->where('permission_key', 'like', 'procurement.evaluation.%')
            ->where('scope_type', 'specific_records')
            ->whereNotNull('scope_reference')
            ->pluck('scope_reference')
            ->map(fn ($v) => (int) $v)
            ->filter()
            ->values()
            ->all();

        $query = ProcurementRequest::query()
            ->where('tenant_id', $user->tenant_id)
            ->whereIn('status', ['evaluation', 'quotes_received', 'rfq_issued', 'submitted', 'approved']);

        if ($specificIds !== []) {
            $query->whereIn('id', $specificIds);
        } else {
            // Without specific_records grants, deny enumeration of the full register.
            $query->whereRaw('1 = 0');
        }

        return response()->json([
            'data' => $query->orderByDesc('id')->limit(100)->get(['id', 'reference_number', 'title', 'status', 'requester_id']),
            'meta' => ['feature_only' => ! $user->can('procurement.module.view') && ! $user->can('procurement.view')],
        ]);
    }

    public function show(Request $request, ProcurementRequest $procurementRequest): JsonResponse
    {
        $user = $request->user();
        $this->pdp->assert($user, 'procurement.evaluation.read.assigned', $procurementRequest, [
            'assigned' => true,
            'assignee_ids' => $this->assignedIds($user, $procurementRequest),
        ]);

        if (! $this->isAssigned($user, $procurementRequest)) {
            abort(404);
        }

        return response()->json(['data' => $procurementRequest->load(['items', 'quotes'])]);
    }

    private function isAssigned($user, ProcurementRequest $procurementRequest): bool
    {
        return UserPermissionGrant::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->where('permission_key', 'like', 'procurement.evaluation.%')
            ->where(function ($q) use ($procurementRequest) {
                $q->where(function ($q2) use ($procurementRequest) {
                    $q2->where('scope_type', 'specific_records')
                        ->where('scope_reference', (string) $procurementRequest->id);
                })->orWhere('scope_type', 'assigned');
            })
            ->exists();
    }

    private function assignedIds($user, ProcurementRequest $procurementRequest): array
    {
        return $this->isAssigned($user, $procurementRequest) ? [(int) $user->id] : [];
    }
}
