<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetUnregisteredFind;
use App\Models\AssetVerificationCampaign;
use App\Models\AssetVerificationResult;
use App\Models\User;
use App\Modules\Assets\Support\AssetAccess;

class AssetVerificationReportService
{
    /**
     * @param  array<string, mixed>  $params
     * @return array{title:string,scope:array<string,mixed>,columns:list<array<string,string>>,data:list<array<string,mixed>>,totals:array<string,mixed>,exceptions:list<array<string,mixed>>,declaration:?string}
     */
    public function build(User $actor, string $reportId, array $params): array
    {
        return match ($reportId) {
            'R31' => $this->campaignProgress($actor),
            'R32' => $this->discrepancies($actor, $params, ['missing'], 'Register not found physically'),
            'R33' => $this->foundNotOnRegister($actor, $params),
            'R34' => $this->discrepancies($actor, $params, ['wrong_location', 'relocated'], 'Location mismatch'),
            'R35' => $this->discrepancies($actor, $params, ['wrong_custodian'], 'Custodian mismatch'),
            'R36' => $this->discrepancies($actor, $params, ['condition_changed', 'damaged'], 'Condition mismatch'),
            'R37' => $this->discrepancyValue($actor, $params),
            'R38' => $this->signOffPack($actor, $params),
            default => abort(404, 'Unknown verification report.'),
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function campaignProgress(User $actor): array
    {
        $showFinance = AssetAccess::canViewFinancials($actor);
        $campaigns = AssetVerificationCampaign::query()
            ->where('tenant_id', $actor->tenant_id)
            ->orderByDesc('id')
            ->get();
        $population = Asset::query()
            ->where('tenant_id', $actor->tenant_id)
            ->whereNotIn('status', ['draft', 'pending'])
            ->count();
        $rows = $campaigns->map(function (AssetVerificationCampaign $campaign) use ($population, $showFinance) {
            $results = $campaign->results()->with('asset')->get();
            $scanned = $results->unique('asset_id')->count();
            $verified = $results->where('result', 'verified')->count();
            $exceptions = $results->where('result', '!=', 'verified')->count();
            $finds = AssetUnregisteredFind::query()->where('campaign_id', $campaign->id)->count();
            $row = [
                'campaign_id' => $campaign->id,
                'campaign' => $campaign->name,
                'status' => $campaign->status,
                'population' => $population,
                'scanned' => $scanned,
                'verified' => $verified,
                'exceptions' => $exceptions,
                'unregistered_finds' => $finds,
                'completion_rate' => $population > 0 ? round(($scanned / $population) * 100, 1) : 0,
            ];
            if ($showFinance) {
                $row['exception_nbv'] = round($results->where('result', '!=', 'verified')->sum(fn (AssetVerificationResult $row) => (float) ($row->asset?->book_value ?? 0)), 2);
            }

            return $row;
        })->all();

        return [
            'title' => 'Campaign progress',
            'scope' => [],
            'columns' => $this->columns(array_values(array_filter([
                'campaign', 'status', 'population', 'scanned', 'verified', 'exceptions', 'unregistered_finds', 'completion_rate',
                $showFinance ? 'exception_nbv' : null,
            ]))),
            'data' => $rows,
            'totals' => [
                'count' => count($rows),
                'population' => $population,
                'open' => $campaigns->where('status', 'open')->count(),
            ],
            'exceptions' => [],
            'declaration' => null,
        ];
    }

    /**
     * @param  list<string>  $results
     * @return array<string, mixed>
     */
    private function discrepancies(User $actor, array $params, array $results, string $title): array
    {
        $campaign = $this->resolveCampaign($actor, $params);
        $showFinance = AssetAccess::canViewFinancials($actor);
        $rows = $this->resultQuery($actor, $campaign)
            ->whereIn('result', $results)
            ->get()
            ->map(fn (AssetVerificationResult $row) => $this->exceptionRow($row, $showFinance))
            ->all();

        return [
            'title' => $title,
            'scope' => $this->campaignScope($campaign),
            'columns' => $this->exceptionColumns($showFinance),
            'data' => $rows,
            'totals' => [
                'count' => count($rows),
                ...($showFinance ? [
                    'purchase_value' => collect($rows)->sum('purchase_value'),
                    'book_value' => collect($rows)->sum('book_value'),
                ] : []),
            ],
            'exceptions' => $rows,
            'declaration' => null,
        ];
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function foundNotOnRegister(User $actor, array $params): array
    {
        $campaign = $this->resolveCampaign($actor, $params);
        $query = AssetUnregisteredFind::query()
            ->with(['finder'])
            ->where('tenant_id', $actor->tenant_id);
        if ($campaign) {
            $query->where('campaign_id', $campaign->id);
        }
        $rows = $query->orderByDesc('id')->limit(2500)->get()->map(fn (AssetUnregisteredFind $find) => [
            'exception_id' => 'UF-'.$find->id,
            'campaign_id' => $find->campaign_id,
            'campaign' => $campaign?->name,
            'description' => $find->description,
            'serial_number' => $find->serial_number,
            'observed_value' => $find->found_location,
            'status' => $find->status,
            'owner' => $find->finder?->name,
            'found_at' => optional($find->found_at)->toDateTimeString(),
            'closed_at' => optional($find->reviewed_at)->toDateTimeString(),
        ])->all();

        return [
            'title' => 'Found not on register',
            'scope' => $this->campaignScope($campaign),
            'columns' => $this->columns(['exception_id', 'description', 'serial_number', 'observed_value', 'status', 'owner', 'found_at']),
            'data' => $rows,
            'totals' => ['count' => count($rows), 'open' => collect($rows)->whereIn('status', ['open', 'investigating'])->count()],
            'exceptions' => collect($rows)->whereIn('status', ['open', 'investigating'])->values()->all(),
            'declaration' => null,
        ];
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function discrepancyValue(User $actor, array $params): array
    {
        $campaign = $this->resolveCampaign($actor, $params);
        $showFinance = AssetAccess::canViewFinancials($actor);
        $rows = $this->resultQuery($actor, $campaign)
            ->where('result', '!=', 'verified')
            ->get()
            ->map(fn (AssetVerificationResult $row) => $this->exceptionRow($row, $showFinance))
            ->all();
        $finds = $this->foundNotOnRegister($actor, $params)['data'];

        return [
            'title' => 'Verification discrepancy value',
            'scope' => $this->campaignScope($campaign),
            'columns' => $this->exceptionColumns($showFinance),
            'data' => $rows,
            'totals' => [
                'count' => count($rows),
                'unregistered_finds' => count($finds),
                ...($showFinance ? [
                    'purchase_value' => collect($rows)->sum('purchase_value'),
                    'book_value' => collect($rows)->sum('book_value'),
                ] : []),
            ],
            'exceptions' => $rows,
            'declaration' => null,
        ];
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function signOffPack(User $actor, array $params): array
    {
        $campaign = $this->resolveCampaign($actor, $params);
        $progress = $this->campaignProgress($actor);
        $selected = collect($progress['data'])->firstWhere('campaign_id', $campaign?->id) ?? ($progress['data'][0] ?? []);
        $exceptions = $this->discrepancyValue($actor, $params);
        $finds = $this->foundNotOnRegister($actor, $params);
        $rows = array_values(array_filter([
            ['section' => 'Campaign', 'item' => $campaign?->name ?? 'No campaign', 'status' => $campaign?->status ?? 'none', 'count' => $selected['population'] ?? 0],
            ['section' => 'Scanned', 'item' => 'Assets scanned', 'status' => 'progress', 'count' => $selected['scanned'] ?? 0],
            ['section' => 'Verified', 'item' => 'Matched to register', 'status' => 'closed', 'count' => $selected['verified'] ?? 0],
            ['section' => 'Exceptions', 'item' => 'Unresolved verification exceptions', 'status' => 'open', 'count' => $exceptions['totals']['count'] ?? 0],
            ['section' => 'Unregistered', 'item' => 'Found not on register', 'status' => 'open', 'count' => $finds['totals']['count'] ?? 0],
        ]));

        return [
            'title' => 'Verification sign-off pack',
            'scope' => $this->campaignScope($campaign),
            'columns' => $this->columns(['section', 'item', 'status', 'count']),
            'data' => $rows,
            'totals' => [
                'count' => $exceptions['totals']['count'] ?? 0,
                'unresolved' => ($exceptions['totals']['count'] ?? 0) + ($finds['totals']['open'] ?? 0),
            ],
            'exceptions' => $exceptions['data'],
            'declaration' => 'I confirm that the campaign population, scan results and unresolved exceptions have been reviewed. Closure requires action, approver, time and retained evidence; observations must not be deleted.',
        ];
    }

    /**
     * @param  array<string, mixed>  $params
     */
    private function resolveCampaign(User $actor, array $params): ?AssetVerificationCampaign
    {
        $query = AssetVerificationCampaign::query()->where('tenant_id', $actor->tenant_id);
        if (! empty($params['campaign_id'])) {
            return $query->whereKey((int) $params['campaign_id'])->first();
        }

        return $query->orderByDesc('id')->first();
    }

    private function resultQuery(User $actor, ?AssetVerificationCampaign $campaign)
    {
        $query = AssetVerificationResult::query()
            ->with(['asset.assignedUser', 'asset.location', 'campaign'])
            ->whereHas('campaign', fn ($q) => $q->where('tenant_id', $actor->tenant_id))
            ->orderByDesc('id');
        if ($campaign) {
            $query->where('campaign_id', $campaign->id);
        }

        return $query;
    }

    /**
     * @return array<string, mixed>
     */
    private function exceptionRow(AssetVerificationResult $row, bool $showFinance): array
    {
        $asset = $row->asset;
        $payload = [
            'exception_id' => 'VX-'.$row->id,
            'campaign_id' => $row->campaign_id,
            'campaign' => $row->campaign?->name,
            'asset_id' => $row->asset_id,
            'asset_tag' => $asset?->tag_number ?: $asset?->asset_code,
            'description' => $asset?->name,
            'result' => $row->result,
            'expected_value' => $asset?->location?->name ?: $asset?->assignedUser?->name,
            'observed_value' => $row->notes ?: $row->condition,
            'status' => $row->result === 'verified' ? 'closed' : 'open',
            'owner' => $asset?->assignedUser?->name,
            'verified_at' => optional($row->verified_at)->toDateTimeString(),
            'closed_at' => $row->result === 'verified' ? optional($row->verified_at)->toDateTimeString() : null,
        ];
        if ($showFinance) {
            $payload['purchase_value'] = $asset?->purchase_value;
            $payload['book_value'] = $asset?->book_value;
        }

        return $payload;
    }

    /**
     * @return list<array{key:string,label:string,type:string}>
     */
    private function exceptionColumns(bool $showFinance): array
    {
        $keys = ['exception_id', 'asset_tag', 'description', 'result', 'expected_value', 'observed_value', 'status', 'owner'];
        if ($showFinance) {
            $keys[] = 'purchase_value';
            $keys[] = 'book_value';
        }

        return $this->columns($keys);
    }

    /**
     * @return array<string, mixed>
     */
    private function campaignScope(?AssetVerificationCampaign $campaign): array
    {
        return array_filter([
            'campaign_id' => $campaign?->id,
            'campaign' => $campaign?->name,
            'status' => $campaign?->status,
        ]);
    }

    /**
     * @param  list<string>  $keys
     * @return list<array{key:string,label:string,type:string}>
     */
    private function columns(array $keys): array
    {
        $labels = [
            'campaign' => 'Campaign',
            'status' => 'Status',
            'population' => 'Population',
            'scanned' => 'Scanned',
            'verified' => 'Verified',
            'exceptions' => 'Exceptions',
            'unregistered_finds' => 'Found not on register',
            'completion_rate' => 'Completion %',
            'exception_nbv' => 'Exception NBV',
            'exception_id' => 'Exception ID',
            'asset_tag' => 'Tag',
            'description' => 'Description',
            'result' => 'Result',
            'expected_value' => 'Expected',
            'observed_value' => 'Observed',
            'owner' => 'Owner',
            'serial_number' => 'Serial',
            'found_at' => 'Found',
            'purchase_value' => 'Cost',
            'book_value' => 'Net book value',
            'section' => 'Section',
            'item' => 'Item',
            'count' => 'Count',
        ];
        $types = [
            'population' => 'number',
            'scanned' => 'number',
            'verified' => 'number',
            'exceptions' => 'number',
            'unregistered_finds' => 'number',
            'completion_rate' => 'number',
            'exception_nbv' => 'number',
            'purchase_value' => 'number',
            'book_value' => 'number',
            'count' => 'number',
            'found_at' => 'date',
        ];

        return array_map(fn (string $key) => [
            'key' => $key,
            'label' => $labels[$key] ?? $key,
            'type' => $types[$key] ?? 'text',
        ], $keys);
    }
}
