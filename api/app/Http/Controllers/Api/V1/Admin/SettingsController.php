<?php
namespace App\Http\Controllers\Api\V1\Admin;
use App\Http\Controllers\Controller;
use App\Models\TenantSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    private array $defaults = [
        'org_name' => 'SADC Parliamentary Forum',
        'org_abbreviation' => 'SADC-PF',
        'org_logo_url' => '/sadcpf-logo.png',
        'org_address' => '129 Robert Mugabe Avenue, Windhoek, Namibia',
        'fiscal_start_month' => 'January',
        'default_currency' => 'NAD',
        'timezone' => 'Africa/Windhoek',
    ];

    public function index(Request $request): JsonResponse
    {
        $stored = TenantSetting::forTenant($request->user()->tenant_id);
        return response()->json(array_merge($this->defaults, $stored));
    }

    public function update(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        $allowed = array_keys($this->defaults);
        foreach ($request->only($allowed) as $key => $value) {
            TenantSetting::setForTenant($tenantId, $key, $value);
        }
        $stored = TenantSetting::forTenant($tenantId);
        return response()->json(array_merge($this->defaults, $stored));
    }
}
