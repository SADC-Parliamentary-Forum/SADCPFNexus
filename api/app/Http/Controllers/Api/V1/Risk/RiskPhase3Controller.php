<?php

namespace App\Http\Controllers\Api\V1\Risk;

use App\Http\Controllers\Controller;
use App\Models\RiskControlTestingCampaign;
use App\Models\RiskControlTestingItem;
use App\Modules\Risk\Services\RiskControlTestingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RiskPhase3Controller extends Controller
{
    public function __construct(private readonly RiskControlTestingService $service) {}

    public function listCampaigns(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->can('risk.view') || $user->can('risk.manage') || $user->can('risk.admin'), 403);

        return response()->json(['data' => $this->service->listCampaigns((int) $user->tenant_id)]);
    }

    public function storeCampaign(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->can('risk.manage') || $user->can('risk.admin'), 403);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'status' => ['sometimes', 'in:draft,scheduled,in_progress,completed,cancelled'],
            'scheduled_start' => ['nullable', 'date'],
            'scheduled_end' => ['nullable', 'date', 'after_or_equal:scheduled_start'],
            'owner_id' => ['nullable', 'integer', 'exists:users,id'],
            'control_ids' => ['sometimes', 'array'],
            'control_ids.*' => ['integer', 'exists:risk_controls,id'],
            'item_due_at' => ['nullable', 'date'],
        ]);

        $campaign = $this->service->createCampaign($data, $user);

        return response()->json(['message' => 'Control-testing campaign created.', 'data' => $campaign], 201);
    }

    public function showCampaign(Request $request, RiskControlTestingCampaign $campaign): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->can('risk.view') || $user->can('risk.manage') || $user->can('risk.admin'), 403);
        abort_unless((int) $campaign->tenant_id === (int) $user->tenant_id, 404);

        $this->service->markOverdueItems((int) $user->tenant_id);

        return response()->json([
            'data' => $campaign->fresh([
                'owner:id,name',
                'items.control:id,control_code,title',
                'items.risk:id,risk_code,title',
                'items.tester:id,name',
            ]),
        ]);
    }

    public function completeItem(Request $request, RiskControlTestingItem $item): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->can('risk.manage') || $user->can('risk.admin'), 403);

        $data = $request->validate([
            'result' => ['required', 'in:pass,fail,waive'],
            'checklist_notes' => ['nullable', 'string'],
            'evidence_notes' => ['nullable', 'string'],
            'evidence_path' => ['nullable', 'string', 'max:500'],
        ]);

        $updated = $this->service->completeItem($item, $data, $user);

        return response()->json(['message' => 'Control test recorded.', 'data' => $updated]);
    }

    public function listBcpLinks(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->can('risk.view') || $user->can('risk.manage') || $user->can('risk.admin'), 403);

        $riskId = $request->integer('risk_id') ?: null;

        return response()->json(['data' => $this->service->listBcpLinks((int) $user->tenant_id, $riskId)]);
    }

    public function storeBcpLink(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->can('risk.manage') || $user->can('risk.admin'), 403);

        $data = $request->validate([
            'risk_id' => ['required', 'integer', 'exists:risks,id'],
            'link_type' => ['required', 'in:bcp_note,insurance_policy'],
            'title' => ['required', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'asset_insurance_policy_id' => ['nullable', 'integer', 'exists:asset_insurance_policies,id'],
        ]);

        $link = $this->service->createBcpLink($data, $user);

        return response()->json(['message' => 'BCP/insurance link created.', 'data' => $link], 201);
    }

    public function listDependencies(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->can('risk.view') || $user->can('risk.manage') || $user->can('risk.admin'), 403);

        $riskId = $request->integer('risk_id') ?: null;

        return response()->json(['data' => $this->service->listDependencies((int) $user->tenant_id, $riskId)]);
    }

    public function storeDependency(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->can('risk.manage') || $user->can('risk.admin'), 403);

        $data = $request->validate([
            'risk_id' => ['required', 'integer', 'exists:risks,id'],
            'related_risk_id' => ['required', 'integer', 'exists:risks,id'],
            'relation_type' => ['sometimes', 'in:depends_on,related_to'],
            'notes' => ['nullable', 'string'],
        ]);

        $dep = $this->service->createDependency($data, $user);

        return response()->json(['message' => 'Risk dependency linked.', 'data' => $dep], 201);
    }

    public function markOverdue(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->can('risk.manage') || $user->can('risk.admin'), 403);

        $count = $this->service->markOverdueItems((int) $user->tenant_id);

        return response()->json(['message' => 'Overdue items refreshed.', 'updated' => $count]);
    }
}
