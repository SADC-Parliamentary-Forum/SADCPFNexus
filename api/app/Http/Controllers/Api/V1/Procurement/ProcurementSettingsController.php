<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Modules\Procurement\Services\ProcurementSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProcurementSettingsController extends Controller
{
    public function __construct(private readonly ProcurementSettingsService $settings) {}

    public function show(Request $request): JsonResponse
    {
        $this->authorizeSettings($request);
        $tenant = Tenant::findOrFail($request->user()->tenant_id);

        return response()->json(['data' => $this->settings->effective($tenant)]);
    }

    public function update(Request $request): JsonResponse
    {
        $this->authorizeSettings($request, write: true);
        $tenant = Tenant::findOrFail($request->user()->tenant_id);
        $data = $this->settings->validatePayload($request->all());
        $effective = $this->settings->update($tenant, $data);

        return response()->json([
            'message' => 'Procurement settings updated.',
            'data'    => $effective,
        ]);
    }

    private function authorizeSettings(Request $request, bool $write = false): void
    {
        $user = $request->user();
        if ($user->isSystemAdmin()) {
            return;
        }

        if ($write) {
            abort_unless($user->hasAnyPermission(['procurement.admin']), 403);
            return;
        }

        abort_unless($user->hasAnyPermission(['procurement.view', 'procurement.admin']), 403);
    }
}
