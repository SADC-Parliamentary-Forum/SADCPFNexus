<?php

namespace App\Http\Controllers\Api\V1\Governance;

use App\Http\Controllers\Controller;
use App\Models\GovernanceCommittee;
use App\Models\GovernanceMeetingType;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CommitteeController extends Controller
{
    // ── Committees ────────────────────────────────────────────────────────────

    public function indexCommittees(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        try {
            $committees = GovernanceCommittee::where('tenant_id', $tenantId)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get();
            return response()->json(['data' => $committees]);
        } catch (QueryException) {
            return response()->json(['data' => []]);
        }
    }

    public function storeCommittee(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name'       => ['required', 'string', 'max:255'],
            'color'      => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'is_active'  => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $committee = GovernanceCommittee::create([
            'tenant_id'  => $user->tenant_id,
            'name'       => $data['name'],
            'color'      => $data['color'] ?? '#6366f1',
            'is_active'  => $data['is_active'] ?? true,
            'sort_order' => $data['sort_order'] ?? 0,
        ]);

        return response()->json(['data' => $committee], 201);
    }

    public function updateCommittee(Request $request, GovernanceCommittee $committee): JsonResponse
    {
        if ((int) $committee->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate([
            'name'       => ['sometimes', 'required', 'string', 'max:255'],
            'color'      => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'is_active'  => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $committee->update(array_filter($data, fn ($v) => $v !== null));

        return response()->json(['data' => $committee->fresh()]);
    }

    public function destroyCommittee(Request $request, GovernanceCommittee $committee): JsonResponse
    {
        if ((int) $committee->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $committee->delete();

        return response()->json(['message' => 'Committee deleted.']);
    }

    // ── Meeting Types ─────────────────────────────────────────────────────────

    public function indexMeetingTypes(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        try {
            $types = GovernanceMeetingType::where('tenant_id', $tenantId)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get();
            return response()->json(['data' => $types]);
        } catch (QueryException) {
            return response()->json(['data' => []]);
        }
    }

    public function storeMeetingType(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name'       => ['required', 'string', 'max:255'],
            'is_active'  => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $type = GovernanceMeetingType::create([
            'tenant_id'  => $user->tenant_id,
            'name'       => $data['name'],
            'is_active'  => $data['is_active'] ?? true,
            'sort_order' => $data['sort_order'] ?? 0,
        ]);

        return response()->json(['data' => $type], 201);
    }

    public function updateMeetingType(Request $request, GovernanceMeetingType $meetingType): JsonResponse
    {
        if ((int) $meetingType->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate([
            'name'       => ['sometimes', 'required', 'string', 'max:255'],
            'is_active'  => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $meetingType->update(array_filter($data, fn ($v) => $v !== null));

        return response()->json(['data' => $meetingType->fresh()]);
    }

    public function destroyMeetingType(Request $request, GovernanceMeetingType $meetingType): JsonResponse
    {
        if ((int) $meetingType->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $meetingType->delete();

        return response()->json(['message' => 'Meeting type deleted.']);
    }
}
