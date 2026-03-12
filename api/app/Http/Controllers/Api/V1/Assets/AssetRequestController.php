<?php

namespace App\Http\Controllers\Api\V1\Assets;

use App\Http\Controllers\Controller;
use App\Models\AssetRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AssetRequestController extends Controller
{
    /**
     * List asset requests. Requester sees own; users with assets.admin see all in tenant.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = AssetRequest::where('tenant_id', $user->tenant_id)
            ->with('requester:id,name,email');

        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('assets.admin')) {
            $query->where('requester_id', $user->id);
        }

        $perPage = min((int) $request->input('per_page', 20), 100);
        $items = $query->orderByDesc('created_at')->paginate($perPage);

        return response()->json($items);
    }

    /**
     * Create an asset request (any authenticated user with assets.view can request).
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'justification' => ['required', 'string', 'max:2000'],
            'document_path' => ['nullable', 'string', 'max:500'],
        ]);

        $user = $request->user();
        $assetRequest = AssetRequest::create([
            'tenant_id'     => $user->tenant_id,
            'requester_id'  => $user->id,
            'justification' => $validated['justification'],
            'status'        => 'pending',
            'document_path' => $validated['document_path'] ?? null,
        ]);

        $assetRequest->load('requester:id,name,email');

        return response()->json($assetRequest, 201);
    }
}
