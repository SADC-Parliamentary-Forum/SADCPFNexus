<?php

namespace App\Http\Controllers\Api\V1\Contracts;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Currency;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Central currency reference. Any authenticated user may read the list; managing
 * it (add/update/activate/default) requires contract-template management or a
 * platform admin.
 */
class CurrencyController extends Controller
{
    private function gateManage(Request $request): void
    {
        abort_unless(
            $request->user()->hasAnyPermission(['contract.manage_template', 'contract.manage_authority', 'admin-console.manage-reference-data'])
            || $request->user()->hasAnyRole(['Procurement Officer', 'System Admin', 'Finance Controller']),
            403
        );
    }

    private function tenantGuard(Request $request, Currency $currency): void
    {
        abort_if((int) $currency->tenant_id !== (int) $request->user()->tenant_id, 404);
    }

    public function index(Request $request): JsonResponse
    {
        $query = Currency::where('tenant_id', $request->user()->tenant_id)->orderBy('sort_order')->orderBy('code');
        if (! $request->boolean('include_inactive')) {
            $query->where('is_active', true);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->gateManage($request);

        $data = $request->validate([
            'code' => ['required', 'string', 'max:8'],
            'name' => ['required', 'string', 'max:255'],
            'symbol' => ['nullable', 'string', 'max:12'],
            'is_default' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer'],
        ]);
        $data['code'] = strtoupper(trim($data['code']));

        $exists = Currency::where('tenant_id', $request->user()->tenant_id)->where('code', $data['code'])->exists();
        abort_if($exists, 422, 'A currency with that code already exists.');

        $currency = DB::transaction(function () use ($request, $data) {
            if (($data['is_default'] ?? false) === true) {
                Currency::where('tenant_id', $request->user()->tenant_id)->update(['is_default' => false]);
            }

            return Currency::create(array_merge($data, [
                'tenant_id' => $request->user()->tenant_id,
                'is_active' => $data['is_active'] ?? true,
            ]));
        });

        AuditLog::record('contract.currency_created', [
            'auditable_type' => Currency::class, 'auditable_id' => $currency->id,
            'new_values' => ['code' => $currency->code], 'tags' => ['contract', 'currency'],
        ]);

        return response()->json(['message' => 'Currency added.', 'data' => $currency], 201);
    }

    public function update(Request $request, Currency $currency): JsonResponse
    {
        $this->gateManage($request);
        $this->tenantGuard($request, $currency);

        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'symbol' => ['nullable', 'string', 'max:12'],
            'is_default' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer'],
        ]);

        DB::transaction(function () use ($request, $currency, $data) {
            if (($data['is_default'] ?? false) === true) {
                Currency::where('tenant_id', $request->user()->tenant_id)->where('id', '!=', $currency->id)->update(['is_default' => false]);
            }
            $currency->update($data);
        });

        AuditLog::record('contract.currency_updated', [
            'auditable_type' => Currency::class, 'auditable_id' => $currency->id,
            'new_values' => $data, 'tags' => ['contract', 'currency'],
        ]);

        return response()->json(['message' => 'Currency updated.', 'data' => $currency->fresh()]);
    }
}
