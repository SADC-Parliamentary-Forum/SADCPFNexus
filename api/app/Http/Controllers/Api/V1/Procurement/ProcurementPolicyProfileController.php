<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\ProcurementPolicyProfile;
use App\Models\Tenant;
use App\Modules\Procurement\Services\ProcurementPolicyProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProcurementPolicyProfileController extends Controller
{
    public function __construct(private readonly ProcurementPolicyProfileService $profiles) {}

    public function index(Request $request): JsonResponse
    {
        $this->gate($request);
        $tenant = Tenant::findOrFail($request->user()->tenant_id);

        return response()->json([
            'data' => $this->profiles->listForTenant($tenant, $request->user()),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->gate($request, write: true);
        $tenant = Tenant::findOrFail($request->user()->tenant_id);
        $data = $request->validate([
            'key'                     => ['required', 'string', 'max:64', 'regex:/^[a-z0-9_]+$/'],
            'name'                    => ['required', 'string', 'max:255'],
            'description'             => ['nullable', 'string'],
            'donor_codes'             => ['nullable', 'array'],
            'donor_codes.*'           => ['string', 'max:64'],
            'direct_purchase_limit'   => ['required', 'numeric', 'min:0'],
            'quotation_limit'         => ['required', 'numeric', 'min:0'],
            'tender_threshold'        => ['nullable', 'numeric', 'min:0'],
            'minimum_quotes_required' => ['nullable', 'integer', 'min:1', 'max:10'],
            'split_lookback_days'     => ['nullable', 'integer', 'min:1', 'max:365'],
            'split_enforcement'       => ['nullable', 'string', 'in:soft,hard'],
            'is_active'               => ['nullable', 'boolean'],
        ]);

        if ($data['direct_purchase_limit'] > $data['quotation_limit']) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors'  => ['direct_purchase_limit' => ['Direct purchase limit cannot exceed the quotation limit.']],
            ], 422);
        }

        $profile = $this->profiles->create($tenant, $request->user(), $data);

        return response()->json(['message' => 'Policy profile created.', 'data' => $profile], 201);
    }

    public function show(Request $request, ProcurementPolicyProfile $policyProfile): JsonResponse
    {
        $this->gate($request);
        $this->assertTenant($request, $policyProfile);

        return response()->json(['data' => $policyProfile]);
    }

    public function update(Request $request, ProcurementPolicyProfile $policyProfile): JsonResponse
    {
        $this->gate($request, write: true);
        $this->assertTenant($request, $policyProfile);
        $data = $request->validate([
            'name'                    => ['sometimes', 'string', 'max:255'],
            'description'             => ['nullable', 'string'],
            'donor_codes'             => ['nullable', 'array'],
            'donor_codes.*'           => ['string', 'max:64'],
            'direct_purchase_limit'   => ['sometimes', 'numeric', 'min:0'],
            'quotation_limit'         => ['sometimes', 'numeric', 'min:0'],
            'tender_threshold'        => ['sometimes', 'numeric', 'min:0'],
            'minimum_quotes_required' => ['sometimes', 'integer', 'min:1', 'max:10'],
            'split_lookback_days'     => ['sometimes', 'integer', 'min:1', 'max:365'],
            'split_enforcement'       => ['sometimes', 'string', 'in:soft,hard'],
            'is_active'               => ['sometimes', 'boolean'],
        ]);

        $profile = $this->profiles->update($policyProfile, $data);

        return response()->json(['message' => 'Policy profile updated.', 'data' => $profile]);
    }

    public function destroy(Request $request, ProcurementPolicyProfile $policyProfile): JsonResponse
    {
        $this->gate($request, write: true);
        $this->assertTenant($request, $policyProfile);
        $this->profiles->delete($policyProfile);

        return response()->json(['message' => 'Policy profile deleted.']);
    }

    public function activate(Request $request, ProcurementPolicyProfile $policyProfile): JsonResponse
    {
        $this->gate($request, write: true);
        $this->assertTenant($request, $policyProfile);
        $tenant = Tenant::findOrFail($request->user()->tenant_id);
        $effective = $this->profiles->activate($tenant, $policyProfile);

        return response()->json([
            'message' => 'Policy profile activated.',
            'data'    => $effective,
        ]);
    }

    private function gate(Request $request, bool $write = false): void
    {
        $user = $request->user();
        if ($user->isSystemAdmin()) {
            return;
        }
        if ($write) {
            abort_unless(
                $user->hasAnyPermission(['procurement.admin'])
                || $user->hasAnyRole(['Procurement Officer', 'Finance Controller', 'Secretary General', 'System Admin', 'super-admin']),
                403
            );
            return;
        }
        abort_unless(
            $user->hasAnyPermission(['procurement.view', 'procurement.admin'])
            || $user->hasAnyRole(['Procurement Officer', 'Finance Controller', 'Secretary General', 'System Admin', 'super-admin']),
            403
        );
    }

    private function assertTenant(Request $request, ProcurementPolicyProfile $profile): void
    {
        if ((int) $profile->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
    }
}
