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

    /**
     * Show a single asset request. Requester sees own; users with assets.admin see all in tenant.
     */
    public function show(Request $request, AssetRequest $assetRequest): JsonResponse
    {
        $user = $request->user();
        if ((int) $assetRequest->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        if ($assetRequest->requester_id !== $user->id && ! $user->isSystemAdmin() && ! $user->hasPermissionTo('assets.admin')) {
            abort(403);
        }
        $assetRequest->load('requester:id,name,email');
        return response()->json($assetRequest);
    }

    /**
     * Update an asset request. Requester can update while pending; admins can change status.
     */
    public function update(Request $request, AssetRequest $assetRequest): JsonResponse
    {
        $user = $request->user();
        if ((int) $assetRequest->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        $isAdmin = $user->isSystemAdmin() || $user->hasPermissionTo('assets.admin');
        $isOwner = $assetRequest->requester_id === $user->id;

        if (! $isAdmin && ! $isOwner) {
            abort(403);
        }

        // Owners can only edit while pending
        if ($isOwner && ! $isAdmin && $assetRequest->status !== 'pending') {
            return response()->json(['message' => 'Only pending requests can be edited.'], 422);
        }

        $rules = [
            'justification' => ['sometimes', 'string', 'max:2000'],
            'document_path' => ['nullable', 'string', 'max:500'],
        ];
        if ($isAdmin) {
            $rules['status'] = ['sometimes', 'string', 'in:pending,approved,rejected,fulfilled'];
        }

        $validated = $request->validate($rules);
        $assetRequest->update($validated);
        $assetRequest->load('requester:id,name,email');

        return response()->json($assetRequest);
    }

    /**
     * Delete an asset request. Requester can cancel pending; admins can delete any.
     */
    public function destroy(Request $request, AssetRequest $assetRequest): JsonResponse
    {
        $user = $request->user();
        if ((int) $assetRequest->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        $isAdmin = $user->isSystemAdmin() || $user->hasPermissionTo('assets.admin');
        $isOwner = $assetRequest->requester_id === $user->id;

        if (! $isAdmin && ! $isOwner) {
            abort(403);
        }
        if ($isOwner && ! $isAdmin && $assetRequest->status !== 'pending') {
            return response()->json(['message' => 'Only pending requests can be cancelled.'], 422);
        }

        $assetRequest->delete();
        return response()->json(['message' => 'Asset request deleted.']);
    }
}
