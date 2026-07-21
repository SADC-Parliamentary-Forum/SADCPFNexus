<?php

namespace App\Http\Controllers\Api\V1\MAndE;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\MeThematicArea;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MeThematicAreaController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $areas = MeThematicArea::where('tenant_id', $request->user()->tenant_id)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();
        return response()->json(['data' => $areas]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => ['required', 'string', 'max:200'],
            'code'        => ['nullable', 'string', 'max:40'],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_active'   => ['nullable', 'boolean'],
            'sort_order'  => ['nullable', 'integer'],
        ]);

        $area = MeThematicArea::create([
            'tenant_id'   => $request->user()->tenant_id,
            'code'        => $data['code'] ?? Str::slug($data['name']),
            'name'        => $data['name'],
            'description' => $data['description'] ?? null,
            'is_active'   => $data['is_active'] ?? true,
            'sort_order'  => $data['sort_order'] ?? 0,
        ]);

        AuditLog::record('mande.thematic_area.created', [
            'auditable_type' => MeThematicArea::class,
            'auditable_id'   => $area->id,
            'tags'           => 'mande',
        ]);

        return response()->json(['message' => 'Thematic area created.', 'data' => $area], 201);
    }

    public function update(Request $request, MeThematicArea $thematicArea): JsonResponse
    {
        $this->ensureTenant($request, $thematicArea);
        $data = $request->validate([
            'name'        => ['sometimes', 'string', 'max:200'],
            'code'        => ['nullable', 'string', 'max:40'],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_active'   => ['nullable', 'boolean'],
            'sort_order'  => ['nullable', 'integer'],
        ]);
        $thematicArea->update($data);
        return response()->json(['message' => 'Thematic area updated.', 'data' => $thematicArea]);
    }

    public function destroy(Request $request, MeThematicArea $thematicArea): JsonResponse
    {
        $this->ensureTenant($request, $thematicArea);
        $thematicArea->delete();
        return response()->json(['message' => 'Thematic area deleted.']);
    }

    private function ensureTenant(Request $request, MeThematicArea $area): void
    {
        if ((int) $area->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
    }
}
