<?php

namespace App\Http\Controllers\Api\V1\Governance;

use App\Http\Controllers\Controller;
use App\Models\GovernanceResolution;
use App\Models\WorkplanEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GovernanceController extends Controller
{
    /**
     * List meetings (from workplan events type=meeting).
     */
    public function meetings(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = WorkplanEvent::where('tenant_id', $user->tenant_id)
            ->where('type', 'meeting')
            ->orderBy('date');

        if ($status = $request->input('status')) {
            if ($status === 'upcoming') {
                $query->where('date', '>=', now()->toDateString());
            } elseif ($status === 'completed') {
                $query->where('date', '<', now()->toDateString());
            }
        }

        $perPage = min((int) $request->input('per_page', 50), 100);
        $events = $query->paginate($perPage);

        $data = $events->getCollection()->map(fn ($e) => [
            'id' => $e->id,
            'title' => $e->title,
            'date' => $e->date?->format('Y-m-d'),
            'end_date' => $e->end_date?->format('Y-m-d'),
            'description' => $e->description,
            'responsible' => $e->responsible,
            'venue' => null,
            'type' => 'meeting',
            'status' => $e->date && $e->date->isPast() ? 'completed' : 'upcoming',
        ]);

        return response()->json([
            'data' => $data,
            'current_page' => $events->currentPage(),
            'last_page' => $events->lastPage(),
            'per_page' => $events->perPage(),
            'total' => $events->total(),
        ]);
    }

    /**
     * List resolutions.
     */
    public function resolutions(Request $request): JsonResponse
    {
        $query = GovernanceResolution::where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('adopted_at')
            ->orderByDesc('created_at');

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        if ($type = $request->input('type')) {
            $query->where('type', $type);
        }

        $perPage = min((int) $request->input('per_page', 20), 100);
        $resolutions = $query->paginate($perPage);

        return response()->json($resolutions);
    }
}
