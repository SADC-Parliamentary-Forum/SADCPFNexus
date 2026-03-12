<?php

namespace App\Http\Controllers\Api\V1\Workplan;

use App\Http\Controllers\Controller;
use App\Models\MeetingType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeetingTypeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        $types = MeetingType::where('tenant_id', $tenantId)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $types]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name'        => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'sort_order'  => ['nullable', 'integer', 'min:0'],
        ]);

        $type = MeetingType::create([
            'tenant_id'   => $user->tenant_id,
            'name'        => $data['name'],
            'description' => $data['description'] ?? null,
            'sort_order'  => $data['sort_order'] ?? null,
        ]);

        return response()->json(['message' => 'Meeting type created.', 'data' => $type], 201);
    }

    public function update(Request $request, MeetingType $meetingType): JsonResponse
    {
        if ((int) $meetingType->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate([
            'name'        => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'sort_order'  => ['nullable', 'integer', 'min:0'],
        ]);

        $meetingType->update($data);

        return response()->json(['message' => 'Meeting type updated.', 'data' => $meetingType->fresh()]);
    }

    public function destroy(Request $request, MeetingType $meetingType): JsonResponse
    {
        if ((int) $meetingType->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        if ($meetingType->workplanEvents()->exists()) {
            return response()->json([
                'message' => 'Cannot delete meeting type that is in use by workplan events.',
            ], 422);
        }

        $meetingType->delete();

        return response()->json(['message' => 'Meeting type deleted.']);
    }
}
