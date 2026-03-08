<?php

namespace App\Http\Controllers\Api\V1\Hr;

use App\Http\Controllers\Controller;
use App\Models\HrIncident;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HrIncidentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = HrIncident::where('tenant_id', $user->tenant_id)
            ->with('reporter:id,name,email')
            ->orderByDesc('reported_at');

        if ($request->input('mine') === '1') {
            $query->where('reported_by', $user->id);
        }

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        $perPage = min((int) $request->input('per_page', 20), 100);
        $incidents = $query->paginate($perPage);

        return response()->json($incidents);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subject'     => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'severity'    => ['nullable', 'string', 'in:low,medium,high'],
        ]);

        $user = $request->user();
        $incident = HrIncident::create([
            'tenant_id'        => $user->tenant_id,
            'reported_by'     => $user->id,
            'reference_number' => HrIncident::generateReferenceNumber(),
            'subject'         => $data['subject'],
            'description'     => $data['description'] ?? null,
            'severity'        => $data['severity'] ?? 'medium',
            'status'          => 'reported',
        ]);

        return response()->json(['message' => 'Incident reported.', 'data' => $incident], 201);
    }

    public function show(Request $request, HrIncident $hrIncident): JsonResponse
    {
        if ($hrIncident->tenant_id !== $request->user()->tenant_id) {
            abort(403);
        }
        $hrIncident->load('reporter:id,name,email');
        return response()->json($hrIncident);
    }
}
