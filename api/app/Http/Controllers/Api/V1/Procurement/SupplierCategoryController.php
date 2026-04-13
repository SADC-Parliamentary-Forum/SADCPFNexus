<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\SupplierCategory;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SupplierCategoryController extends Controller
{
    public function publicIndex(Request $request): JsonResponse
    {
        $tenantId = (int) ($request->query('tenant_id')
            ?: Tenant::query()->where('is_active', true)->value('id')
            ?: Tenant::query()->value('id'));

        $categories = SupplierCategory::query()
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $categories]);
    }

    public function index(Request $request): JsonResponse
    {
        $categories = SupplierCategory::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $categories]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCanManage($request);

        $data = $request->validate([
            'name'        => ['required', 'string', 'max:150'],
            'code'        => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active'   => ['sometimes', 'boolean'],
        ]);

        $category = SupplierCategory::create([
            'tenant_id'    => $request->user()->tenant_id,
            'name'         => $data['name'],
            'code'         => $data['code'] ?? Str::slug($data['name'], '_'),
            'description'  => $data['description'] ?? null,
            'is_active'    => $data['is_active'] ?? true,
        ]);

        return response()->json(['message' => 'Supplier category created.', 'data' => $category], 201);
    }

    public function update(Request $request, SupplierCategory $supplierCategory): JsonResponse
    {
        $this->ensureCanManage($request);
        if ((int) $supplierCategory->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate([
            'name'        => ['sometimes', 'required', 'string', 'max:150'],
            'code'        => ['sometimes', 'required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active'   => ['sometimes', 'boolean'],
        ]);

        $supplierCategory->update([
            'name'        => $data['name'] ?? $supplierCategory->name,
            'code'        => $data['code'] ?? $supplierCategory->code,
            'description' => array_key_exists('description', $data) ? $data['description'] : $supplierCategory->description,
            'is_active'   => $data['is_active'] ?? $supplierCategory->is_active,
        ]);

        return response()->json(['message' => 'Supplier category updated.', 'data' => $supplierCategory->fresh()]);
    }

    public function destroy(Request $request, SupplierCategory $supplierCategory): JsonResponse
    {
        $this->ensureCanManage($request);
        if ((int) $supplierCategory->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $supplierCategory->delete();

        return response()->json(['message' => 'Supplier category deleted.']);
    }

    private function ensureCanManage(Request $request): void
    {
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'System Admin', 'Secretary General'])) {
            abort(403);
        }
    }
}
