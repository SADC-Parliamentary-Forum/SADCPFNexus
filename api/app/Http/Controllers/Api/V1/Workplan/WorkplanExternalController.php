<?php
namespace App\Http\Controllers\Api\V1\Workplan;

use App\Http\Controllers\Controller;
use App\Models\WorkplanEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkplanExternalController extends Controller
{
    /**
     * Retrieve a list of workplan events for external systems.
     * Optionally filter by year, month, type, or a generic keyword.
     */
    public function index(Request $request): JsonResponse
    {
        // For external consumption, we bypass RLS if needed using withoutGlobalScopes 
        // depending on the architecture, but we'll try standard query first.
        $query = clone WorkplanEvent::with('creator')->orderBy('date');

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('month') && $request->filled('year')) {
            $query->whereMonth('date', $request->input('month'))
                  ->whereYear('date', $request->input('year'));
        } elseif ($request->filled('year')) {
            $query->whereYear('date', $request->input('year'));
        }

        if ($request->filled('keyword')) {
            $keyword = $request->input('keyword');
            $query->where(function ($q) use ($keyword) {
                $q->where('title', 'like', "%{$keyword}%")
                  ->orWhere('description', 'like', "%{$keyword}%");
            });
        }

        return response()->json([
            'success' => true,
            'message' => 'Workplan events retrieved successfully.',
            'data'    => $query->get()
        ]);
    }
}
