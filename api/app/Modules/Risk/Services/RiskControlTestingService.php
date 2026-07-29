<?php

namespace App\Modules\Risk\Services;

use App\Models\AssetInsurancePolicy;
use App\Models\Risk;
use App\Models\RiskBcpLink;
use App\Models\RiskControl;
use App\Models\RiskControlTestingCampaign;
use App\Models\RiskControlTestingItem;
use App\Models\RiskDependency;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RiskControlTestingService
{
    public function listCampaigns(int $tenantId): array
    {
        $this->markOverdueItems($tenantId);

        return RiskControlTestingCampaign::query()
            ->where('tenant_id', $tenantId)
            ->with(['owner:id,name', 'items.control:id,control_code,title'])
            ->withCount([
                'items',
                'items as overdue_items_count' => fn ($q) => $q->where('status', 'overdue'),
                'items as open_items_count' => fn ($q) => $q->whereIn('status', ['pending', 'in_progress', 'overdue']),
            ])
            ->orderByDesc('id')
            ->get()
            ->all();
    }

    public function createCampaign(array $data, User $user): RiskControlTestingCampaign
    {
        return DB::transaction(function () use ($data, $user) {
            $campaign = RiskControlTestingCampaign::create([
                'tenant_id' => $user->tenant_id,
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'status' => $data['status'] ?? 'scheduled',
                'scheduled_start' => $data['scheduled_start'] ?? null,
                'scheduled_end' => $data['scheduled_end'] ?? null,
                'owner_id' => $data['owner_id'] ?? $user->id,
                'created_by' => $user->id,
            ]);

            $controlIds = $data['control_ids'] ?? [];
            foreach ($controlIds as $controlId) {
                $control = RiskControl::query()
                    ->where('tenant_id', $user->tenant_id)
                    ->where('id', $controlId)
                    ->firstOrFail();

                $riskId = $control->risks()
                    ->where('risks.tenant_id', $user->tenant_id)
                    ->value('risks.id');

                RiskControlTestingItem::create([
                    'tenant_id' => $user->tenant_id,
                    'campaign_id' => $campaign->id,
                    'control_id' => $control->id,
                    'risk_id' => $riskId,
                    'status' => 'pending',
                    'due_at' => $data['scheduled_end'] ?? $data['item_due_at'] ?? null,
                ]);
            }

            return $campaign->load(['owner:id,name', 'items.control:id,control_code,title']);
        });
    }

    public function completeItem(RiskControlTestingItem $item, array $data, User $user): RiskControlTestingItem
    {
        abort_unless((int) $item->tenant_id === (int) $user->tenant_id, 404);

        $result = $data['result'] ?? null;
        if (! in_array($result, RiskControlTestingItem::RESULTS, true)) {
            throw ValidationException::withMessages(['result' => 'Result must be pass, fail, or waive.']);
        }

        $status = match ($result) {
            'pass' => 'passed',
            'fail' => 'failed',
            'waive' => 'waived',
        };

        $item->update([
            'result' => $result,
            'status' => $status,
            'checklist_notes' => $data['checklist_notes'] ?? $item->checklist_notes,
            'evidence_notes' => $data['evidence_notes'] ?? $item->evidence_notes,
            'evidence_path' => $data['evidence_path'] ?? $item->evidence_path,
            'tested_by' => $user->id,
            'completed_at' => now(),
        ]);

        $campaign = $item->campaign;
        if ($campaign && $campaign->items()->whereIn('status', ['pending', 'in_progress', 'overdue'])->doesntExist()) {
            $campaign->update(['status' => 'completed', 'completed_at' => now()]);
        } elseif ($campaign && $campaign->status === 'scheduled') {
            $campaign->update(['status' => 'in_progress']);
        }

        return $item->fresh(['control:id,control_code,title', 'tester:id,name', 'campaign']);
    }

    public function markOverdueItems(?int $tenantId = null): int
    {
        $query = RiskControlTestingItem::query()
            ->whereIn('status', ['pending', 'in_progress'])
            ->whereNotNull('due_at')
            ->whereDate('due_at', '<', now()->toDateString());

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        return $query->update(['status' => 'overdue']);
    }

    public function listBcpLinks(int $tenantId, ?int $riskId = null): array
    {
        $q = RiskBcpLink::query()
            ->where('tenant_id', $tenantId)
            ->with(['risk:id,risk_code,title', 'insurancePolicy:id,policy_number,insurer_name,status', 'creator:id,name'])
            ->orderByDesc('id');

        if ($riskId) {
            $q->where('risk_id', $riskId);
        }

        return $q->get()->all();
    }

    public function createBcpLink(array $data, User $user): RiskBcpLink
    {
        $risk = Risk::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('id', $data['risk_id'])
            ->firstOrFail();

        $linkType = $data['link_type'];
        if (! in_array($linkType, RiskBcpLink::TYPES, true)) {
            throw ValidationException::withMessages(['link_type' => 'Invalid link type.']);
        }

        $policyId = $data['asset_insurance_policy_id'] ?? null;
        if ($linkType === 'insurance_policy') {
            if (! $policyId) {
                throw ValidationException::withMessages(['asset_insurance_policy_id' => 'Insurance policy is required.']);
            }
            AssetInsurancePolicy::query()
                ->where('tenant_id', $user->tenant_id)
                ->where('id', $policyId)
                ->firstOrFail();
        }

        return RiskBcpLink::create([
            'tenant_id' => $user->tenant_id,
            'risk_id' => $risk->id,
            'link_type' => $linkType,
            'title' => $data['title'],
            'notes' => $data['notes'] ?? null,
            'asset_insurance_policy_id' => $policyId,
            'created_by' => $user->id,
        ])->load(['risk:id,risk_code,title', 'insurancePolicy:id,policy_number,insurer_name,status']);
    }

    public function listDependencies(int $tenantId, ?int $riskId = null): array
    {
        $q = RiskDependency::query()
            ->where('tenant_id', $tenantId)
            ->with(['risk:id,risk_code,title', 'relatedRisk:id,risk_code,title'])
            ->orderByDesc('id');

        if ($riskId) {
            $q->where(function ($inner) use ($riskId) {
                $inner->where('risk_id', $riskId)->orWhere('related_risk_id', $riskId);
            });
        }

        return $q->get()->all();
    }

    public function createDependency(array $data, User $user): RiskDependency
    {
        $riskId = (int) $data['risk_id'];
        $relatedId = (int) $data['related_risk_id'];

        if ($riskId === $relatedId) {
            throw ValidationException::withMessages(['related_risk_id' => 'A risk cannot depend on itself.']);
        }

        Risk::query()->where('tenant_id', $user->tenant_id)->where('id', $riskId)->firstOrFail();
        Risk::query()->where('tenant_id', $user->tenant_id)->where('id', $relatedId)->firstOrFail();

        $relation = $data['relation_type'] ?? 'depends_on';
        if (! in_array($relation, RiskDependency::TYPES, true)) {
            throw ValidationException::withMessages(['relation_type' => 'Invalid relation type.']);
        }

        return RiskDependency::query()->firstOrCreate(
            [
                'risk_id' => $riskId,
                'related_risk_id' => $relatedId,
                'relation_type' => $relation,
            ],
            [
                'tenant_id' => $user->tenant_id,
                'notes' => $data['notes'] ?? null,
                'created_by' => $user->id,
            ]
        )->load(['risk:id,risk_code,title', 'relatedRisk:id,risk_code,title']);
    }
}
