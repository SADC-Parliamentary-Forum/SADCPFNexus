<?php

namespace App\Http\Controllers\Api\V1\Workplan;

use App\Http\Controllers\Controller;
use App\Models\WorkplanEventType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class WorkplanEventTypeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $types = WorkplanEventType::forTenant($request->user()->tenant_id)->get();
        return response()->json(['data' => $types]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSystemAdmin() && !$user->hasAnyRole(['System Admin', 'Governance Officer', 'HR Administrator'])) {
            abort(403);
        }

        $data = $request->validate([
            'name'       => ['required', 'string', 'max:64'],
            'icon'       => ['nullable', 'string', 'max:64'],
            'color'      => ['nullable', 'string', 'max:32'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $tenantId = $request->user()->tenant_id;
        $slug = Str::slug($data['name'], '_');

        // Ensure slug is unique within tenant
        $base = $slug;
        $i = 2;
        while (WorkplanEventType::where('tenant_id', $tenantId)->where('slug', $slug)->exists()) {
            $slug = $base . '_' . $i++;
        }

        $type = WorkplanEventType::create([
            'tenant_id'  => $tenantId,
            'name'       => $data['name'],
            'slug'       => $slug,
            'icon'       => $data['icon'] ?? 'event',
            'color'      => $data['color'] ?? 'neutral',
            'is_system'  => false,
            'sort_order' => $data['sort_order'] ?? 0,
        ]);

        return response()->json(['message' => 'Event type created.', 'data' => $type], 201);
    }

    public function update(Request $request, WorkplanEventType $eventType): JsonResponse
    {
        if ((int) $eventType->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate([
            'name'       => ['sometimes', 'required', 'string', 'max:64'],
            'icon'       => ['nullable', 'string', 'max:64'],
            'color'      => ['nullable', 'string', 'max:32'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $eventType->update(array_filter([
            'name'       => $data['name'] ?? null,
            'icon'       => $data['icon'] ?? null,
            'color'      => $data['color'] ?? null,
            'sort_order' => $data['sort_order'] ?? null,
        ], fn ($v) => $v !== null));

        return response()->json(['message' => 'Event type updated.', 'data' => $eventType->fresh()]);
    }

    public function destroy(Request $request, WorkplanEventType $eventType): JsonResponse
    {
        if ((int) $eventType->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        if ($eventType->is_system) {
            return response()->json(['message' => 'System event types cannot be deleted.'], 422);
        }
        if ($eventType->isInUse()) {
            return response()->json(['message' => 'Cannot delete an event type that is in use by existing events.'], 422);
        }
        $eventType->delete();
        return response()->json(['message' => 'Event type deleted.']);
    }
}
