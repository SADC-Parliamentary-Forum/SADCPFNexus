<?php

namespace App\Http\Controllers\Api\V1\Assets;

use App\Http\Controllers\Controller;
use App\Models\AssetCategory;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AssetCategoryController extends Controller
{
    /**
     * List asset categories for the current tenant.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $this->canList($user)) {
            abort(403, 'Not authorised to view asset categories.');
        }

        $categories = AssetCategory::forTenant($user->tenant_id)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $categories]);
    }

    /**
     * Create an asset category.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $this->canMutate($user)) {
            abort(403, 'Not authorised to manage asset categories.');
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => [
                'required',
                'string',
                'max:32',
                'regex:/^[a-z0-9_-]+$/',
                Rule::unique('asset_categories', 'code')->where('tenant_id', $user->tenant_id),
            ],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'useful_life_years' => ['nullable', 'integer', 'min:1', 'max:80'],
        ]);

        $category = AssetCategory::create([
            'tenant_id' => $user->tenant_id,
            'name' => $data['name'],
            'code' => strtolower($data['code']),
            'sort_order' => $data['sort_order'] ?? 0,
            'useful_life_years' => $data['useful_life_years'] ?? null,
        ]);

        return response()->json(['message' => 'Category created.', 'data' => $category], 201);
    }

    /**
     * Update an asset category.
     */
    public function update(Request $request, AssetCategory $assetCategory): JsonResponse
    {
        $user = $request->user();
        if (! $this->canMutate($user)) {
            abort(403, 'Not authorised to manage asset categories.');
        }
        if ((int) $assetCategory->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'code' => [
                'sometimes',
                'required',
                'string',
                'max:32',
                'regex:/^[a-z0-9_-]+$/',
                Rule::unique('asset_categories', 'code')->where('tenant_id', $user->tenant_id)->ignore($assetCategory->id),
            ],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'useful_life_years' => ['nullable', 'integer', 'min:1', 'max:80'],
        ]);

        if (isset($data['code'])) {
            $data['code'] = strtolower($data['code']);
            if ($data['code'] !== $assetCategory->code && $assetCategory->assets()->exists()) {
                abort(422, 'Cannot change the code while assets use this category.');
            }
        }
        $assetCategory->update($data);

        return response()->json(['message' => 'Category updated.', 'data' => $assetCategory->fresh()]);
    }

    /**
     * Delete an asset category. Forbidden if any asset uses this category.
     */
    public function destroy(Request $request, AssetCategory $assetCategory): JsonResponse
    {
        $user = $request->user();
        if (! $this->canMutate($user)) {
            abort(403, 'Not authorised to manage asset categories.');
        }
        if ((int) $assetCategory->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        if ($assetCategory->assets()->exists()) {
            abort(422, 'Cannot delete category: it is in use by one or more assets.');
        }

        $assetCategory->delete();

        return response()->json(['message' => 'Category deleted.']);
    }

    private function canList(User $user): bool
    {
        if ($user->isSystemAdmin()) {
            return true;
        }

        return $user->hasAnyPermission([
            'assets.view', 'assets.create', 'assets.edit', 'assets.admin', 'assets.manage', 'assets.import',
        ]);
    }

    private function canMutate(User $user): bool
    {
        if ($user->isSystemAdmin()) {
            return true;
        }

        return $user->hasAnyPermission([
            'assets.admin', 'assets.manage', 'assets.create', 'assets.import', 'assets.edit',
        ]);
    }
}
