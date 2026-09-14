<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\SupplierDocumentRequirementType;
use App\Modules\Procurement\Services\SupplierCatalogueSeeder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SupplierDocumentRequirementTypeController extends Controller
{
    public function __construct(
        private readonly SupplierCatalogueSeeder $catalogue,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->assertAdmin($request);
        $this->catalogue->ensureForTenant((int) $request->user()->tenant_id);

        $rows = SupplierDocumentRequirementType::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderBy('sort_order')
            ->orderBy('label')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->assertAdmin($request);
        $data = $this->validated($request);

        $type = SupplierDocumentRequirementType::create([
            'tenant_id' => $request->user()->tenant_id,
            'code' => $data['code'] ?? Str::slug($data['label'], '_'),
            'label' => $data['label'],
            'description' => $data['description'] ?? null,
            'mandatory' => $data['mandatory'] ?? false,
            'country' => $data['country'] ?? null,
            'supplier_category_id' => $data['supplier_category_id'] ?? null,
            'has_expiry' => $data['has_expiry'] ?? false,
            'warning_days' => $data['warning_days'] ?? 90,
            'required_at_registration' => $data['required_at_registration'] ?? false,
            'required_for_rfq' => $data['required_for_rfq'] ?? false,
            'funding_source' => $data['funding_source'] ?? null,
            'requires_verification' => $data['requires_verification'] ?? true,
            'is_active' => $data['is_active'] ?? true,
            'sort_order' => $data['sort_order'] ?? 100,
        ]);

        return response()->json(['message' => 'Document requirement created.', 'data' => $type], 201);
    }

    public function update(Request $request, SupplierDocumentRequirementType $requirementType): JsonResponse
    {
        $this->assertAdmin($request);
        if ((int) $requirementType->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $this->validated($request, false);
        $requirementType->update($data);

        return response()->json(['message' => 'Document requirement updated.', 'data' => $requirementType->fresh()]);
    }

    public function destroy(Request $request, SupplierDocumentRequirementType $requirementType): JsonResponse
    {
        $this->assertAdmin($request);
        if ((int) $requirementType->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $requirementType->update(['is_active' => false]);

        return response()->json(['message' => 'Document requirement deactivated.']);
    }

    private function validated(Request $request, bool $creating = true): array
    {
        return $request->validate([
            'code' => [$creating ? 'nullable' : 'sometimes', 'string', 'max:80'],
            'label' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'mandatory' => ['sometimes', 'boolean'],
            'country' => ['nullable', 'string', 'max:100'],
            'supplier_category_id' => [
                'nullable',
                'integer',
                Rule::exists('supplier_categories', 'id')->where('tenant_id', $request->user()->tenant_id),
            ],
            'has_expiry' => ['sometimes', 'boolean'],
            'warning_days' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'required_at_registration' => ['sometimes', 'boolean'],
            'required_for_rfq' => ['sometimes', 'boolean'],
            'funding_source' => ['nullable', 'string', 'max:80'],
            'requires_verification' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:1000'],
        ]);
    }

    private function assertAdmin(Request $request): void
    {
        $user = $request->user();
        abort_unless($user->isSystemAdmin() || $user->can('procurement.admin'), 403);
    }
}
