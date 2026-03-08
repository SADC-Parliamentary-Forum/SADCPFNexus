<?php

namespace App\Http\Controllers\Api\V1\Assets;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssetController extends Controller
{
    /**
     * List assets. Optional ?assigned_to=me for current user's assigned assets only.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Asset::where('tenant_id', $user->tenant_id);

        if ($request->input('assigned_to') === 'me') {
            $query->where('assigned_to', $user->id);
        }

        if ($category = $request->input('category')) {
            $query->where('category', $category);
        }

        $perPage = min((int) $request->input('per_page', 50), 100);
        $assets = $query->orderBy('name')->paginate($perPage);

        return response()->json($assets);
    }
}
