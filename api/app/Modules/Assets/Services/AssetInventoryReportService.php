<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetHandover;
use App\Models\AssetLocationHistory;
use App\Models\AssetTransfer;
use App\Models\User;
use App\Modules\Assets\Support\AssetAccess;
use Illuminate\Support\Carbon;

class AssetInventoryReportService
{
    /**
     * @param  array<string, mixed>  $params
     * @return array{title:string,scope:array<string,mixed>,columns:list<array<string,string>>,data:list<array<string,mixed>>,totals:array<string,mixed>,exceptions:list<array<string,mixed>>,declaration:?string}
     */
    public function build(User $actor, string $reportId, array $params): array
    {
        return match ($reportId) {
            'R11' => $this->masterRegister($actor, $params, 'capital'),
            'R12' => $this->masterRegister($actor, $params, 'controlled'),
            'R13' => $this->byLocation($actor),
            'R14' => $this->byClass($actor),
            'R15' => $this->movements($actor),
            'R16' => $this->inTransit($actor),
            'R17' => $this->acquisitions($actor, $params),
            'R18' => $this->grantAndDonated($actor),
            'R19' => $this->untagged($actor),
            default => abort(404, 'Unknown inventory report.'),
        };
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function masterRegister(User $actor, array $params, string $class): array
    {
        $showFinance = AssetAccess::canViewFinancials($actor);
        $query = Asset::query()
            ->with(['assignedUser', 'location'])
            ->where('tenant_id', $actor->tenant_id)
            ->orderBy('asset_code');
        if ($class === 'controlled') {
            $query->where('asset_class', 'controlled');
        } else {
            $query->where(function ($q) {
                $q->where('asset_class', 'capital')->orWhereNull('asset_class')->orWhere('asset_class', '');
            });
        }
        if (! empty($params['department'])) {
            $query->where('department', $params['department']);
        }
        $rows = $query->limit(10000)->get()->map(fn (Asset $asset) => $this->assetRow($asset, $showFinance))->all();
        $capital = collect($rows)->filter(fn (array $row) => ($row['register_class'] ?? '') !== 'controlled')->count();

        return [
            'title' => $class === 'controlled' ? 'Controlled non-capital items' : 'Master fixed asset register',
            'scope' => array_filter(['register_class' => $class, 'department' => $params['department'] ?? null]),
            'columns' => $this->columns([
                'asset_tag', 'description', 'class', 'serial_number', 'custodian_name',
                'location', 'department', 'asset_status', 'register_class', 'funding_source',
            ], $showFinance),
            'data' => $rows,
            'totals' => [
                'count' => count($rows),
                'capital' => $class === 'controlled' ? 0 : $capital,
                'controlled' => $class === 'controlled' ? count($rows) : count($rows) - $capital,
            ],
            'exceptions' => [],
            'declaration' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function byLocation(User $actor): array
    {
        $showFinance = AssetAccess::canViewFinancials($actor);
        $assets = Asset::query()
            ->with(['location', 'assignedUser'])
            ->where('tenant_id', $actor->tenant_id)
            ->whereNotIn('status', Asset::DISPOSED_STATUSES)
            ->orderBy('location_id')
            ->limit(10000)
            ->get();
        $rows = $assets->map(fn (Asset $asset) => $this->assetRow($asset, $showFinance, [
            'site' => $asset->location?->name,
            'building' => $asset->location?->building,
            'floor' => $asset->location?->floor,
            'room' => $asset->location?->room,
        ]))->all();

        return [
            'title' => 'Assets by location',
            'scope' => [],
            'columns' => $this->columns(['site', 'building', 'floor', 'room', 'asset_tag', 'description', 'custodian_name', 'asset_status'], $showFinance),
            'data' => $rows,
            'totals' => [
                'count' => count($rows),
                'locations' => $assets->pluck('location_id')->filter()->unique()->count(),
            ],
            'exceptions' => [],
            'declaration' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function byClass(User $actor): array
    {
        $showFinance = AssetAccess::canViewFinancials($actor);
        $assets = Asset::query()
            ->where('tenant_id', $actor->tenant_id)
            ->whereNotIn('status', Asset::DISPOSED_STATUSES)
            ->get();
        $rows = $assets->groupBy(fn (Asset $asset) => $asset->asset_class ?: $asset->category ?: 'uncategorised')
            ->map(function ($group, $class) use ($showFinance) {
                $row = [
                    'class' => $class,
                    'count' => $group->count(),
                    'description' => $class,
                ];
                if ($showFinance) {
                    $row['purchase_value'] = $group->sum(fn (Asset $asset) => (float) $asset->purchase_value);
                    $row['book_value'] = $group->sum(fn (Asset $asset) => (float) ($asset->book_value ?? 0));
                }

                return $row;
            })->values()->all();
        $classColumns = ['class', 'count'];
        if ($showFinance) {
            $classColumns[] = 'purchase_value';
            $classColumns[] = 'book_value';
        }

        return [
            'title' => 'Assets by class',
            'scope' => [],
            'columns' => $this->columns($classColumns, $showFinance),
            'data' => $rows,
            'totals' => ['count' => $assets->count(), 'classes' => count($rows)],
            'exceptions' => [],
            'declaration' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function movements(User $actor): array
    {
        $locations = AssetLocationHistory::query()
            ->with(['asset', 'location'])
            ->where('tenant_id', $actor->tenant_id)
            ->orderByDesc('moved_at')
            ->limit(2500)
            ->get()
            ->map(fn (AssetLocationHistory $row) => [
                'asset_id' => $row->asset_id,
                'asset_tag' => $row->asset?->tag_number ?: $row->asset?->asset_code,
                'description' => $row->asset?->name,
                'movement_type' => 'location',
                'from_to' => $row->location?->name ?: $row->location_label,
                'status' => 'recorded',
                'moved_at' => optional($row->moved_at)->toDateTimeString(),
            ]);
        $transfers = AssetTransfer::query()
            ->with(['asset', 'fromUser', 'toUser'])
            ->where('tenant_id', $actor->tenant_id)
            ->orderByDesc('id')
            ->limit(2500)
            ->get()
            ->map(fn (AssetTransfer $row) => [
                'asset_id' => $row->asset_id,
                'asset_tag' => $row->asset?->tag_number ?: $row->asset?->asset_code,
                'description' => $row->asset?->name,
                'movement_type' => 'custodian',
                'from_to' => trim(($row->fromUser?->name ?? '—').' → '.($row->toUser?->name ?? '—')),
                'status' => $row->status,
                'moved_at' => optional($row->completed_at ?? $row->accepted_at ?? $row->created_at)->toDateTimeString(),
            ]);
        $rows = $locations->concat($transfers)->sortByDesc('moved_at')->values()->all();

        return [
            'title' => 'Asset movement register',
            'scope' => [],
            'columns' => [
                ['key' => 'asset_tag', 'label' => 'Tag', 'type' => 'text'],
                ['key' => 'description', 'label' => 'Description', 'type' => 'text'],
                ['key' => 'movement_type', 'label' => 'Type', 'type' => 'text'],
                ['key' => 'from_to', 'label' => 'From / to', 'type' => 'text'],
                ['key' => 'status', 'label' => 'Status', 'type' => 'text'],
                ['key' => 'moved_at', 'label' => 'Moved', 'type' => 'date'],
            ],
            'data' => $rows,
            'totals' => ['count' => count($rows)],
            'exceptions' => collect($rows)->whereIn('status', ['pending_outgoing', 'pending_incoming'])->values()->all(),
            'declaration' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function inTransit(User $actor): array
    {
        $transfers = AssetTransfer::query()
            ->with(['asset', 'fromUser', 'toUser'])
            ->where('tenant_id', $actor->tenant_id)
            ->whereIn('status', ['pending_outgoing', 'pending_incoming'])
            ->orderByDesc('id')
            ->get()
            ->map(fn (AssetTransfer $row) => [
                'asset_id' => $row->asset_id,
                'asset_tag' => $row->asset?->tag_number ?: $row->asset?->asset_code,
                'description' => $row->asset?->name,
                'movement_type' => 'transfer',
                'from_to' => trim(($row->fromUser?->name ?? '—').' → '.($row->toUser?->name ?? '—')),
                'status' => $row->status,
                'moved_at' => optional($row->outgoing_confirmed_at ?? $row->created_at)->toDateTimeString(),
            ]);
        $handovers = AssetHandover::query()
            ->where('tenant_id', $actor->tenant_id)
            ->whereNotNull('sent_at')
            ->whereNull('accepted_at')
            ->whereNotIn('status', ['cancelled', 'accepted', 'completed'])
            ->limit(1000)
            ->get()
            ->map(fn (AssetHandover $row) => [
                'asset_id' => null,
                'asset_tag' => $row->reference,
                'description' => $row->type,
                'movement_type' => 'handover',
                'from_to' => $row->status,
                'status' => 'in_transit',
                'moved_at' => optional($row->sent_at)->toDateTimeString(),
            ]);
        $rows = $transfers->concat($handovers)->values()->all();

        return [
            'title' => 'Assets in transit',
            'scope' => [],
            'columns' => [
                ['key' => 'asset_tag', 'label' => 'Tag / reference', 'type' => 'text'],
                ['key' => 'description', 'label' => 'Description', 'type' => 'text'],
                ['key' => 'movement_type', 'label' => 'Type', 'type' => 'text'],
                ['key' => 'from_to', 'label' => 'From / to', 'type' => 'text'],
                ['key' => 'status', 'label' => 'Status', 'type' => 'text'],
                ['key' => 'moved_at', 'label' => 'Dispatched', 'type' => 'date'],
            ],
            'data' => $rows,
            'totals' => ['count' => count($rows)],
            'exceptions' => $rows,
            'declaration' => null,
        ];
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function acquisitions(User $actor, array $params): array
    {
        $showFinance = AssetAccess::canViewFinancials($actor);
        $from = isset($params['from']) ? Carbon::parse((string) $params['from'])->startOfDay() : now()->subYear()->startOfDay();
        $to = isset($params['to']) ? Carbon::parse((string) $params['to'])->endOfDay() : (isset($params['as_of']) ? Carbon::parse((string) $params['as_of'])->endOfDay() : now()->endOfDay());
        $assets = Asset::query()
            ->with(['assignedUser', 'location'])
            ->where('tenant_id', $actor->tenant_id)
            ->where(function ($q) use ($from, $to) {
                $q->whereBetween('purchase_date', [$from, $to])
                    ->orWhereBetween('received_date', [$from, $to])
                    ->orWhereBetween('capitalisation_date', [$from, $to]);
            })
            ->orderByDesc('purchase_date')
            ->limit(5000)
            ->get();
        $rows = $assets->map(fn (Asset $asset) => $this->assetRow($asset, $showFinance, [
            'acquisition_date' => optional($asset->capitalisation_date ?? $asset->received_date ?? $asset->purchase_date)->toDateString(),
        ]))->all();

        return [
            'title' => 'New acquisitions',
            'scope' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'columns' => $this->columns(['asset_tag', 'description', 'class', 'acquisition_date', 'funding_source', 'asset_status'], $showFinance),
            'data' => $rows,
            'totals' => ['count' => count($rows)],
            'exceptions' => [],
            'declaration' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function grantAndDonated(User $actor): array
    {
        $showFinance = AssetAccess::canViewFinancials($actor);
        $assets = Asset::query()
            ->with(['assignedUser', 'location'])
            ->where('tenant_id', $actor->tenant_id)
            ->where(function ($q) {
                $q->whereNotNull('donor_name')
                    ->orWhereIn('ownership_type', ['donated', 'grant', 'donor'])
                    ->orWhereIn('funding_source', ['grant', 'donor', 'donation', 'donated']);
            })
            ->orderBy('asset_code')
            ->limit(5000)
            ->get();
        $rows = $assets->map(fn (Asset $asset) => $this->assetRow($asset, $showFinance, [
            'donor_name' => $asset->donor_name,
        ]))->all();

        return [
            'title' => 'Grant and donated assets',
            'scope' => [],
            'columns' => $this->columns(['asset_tag', 'description', 'funding_source', 'donor_name', 'asset_status'], $showFinance),
            'data' => $rows,
            'totals' => ['count' => count($rows)],
            'exceptions' => collect($rows)->whereNull('donor_name')->values()->all(),
            'declaration' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function untagged(User $actor): array
    {
        $showFinance = AssetAccess::canViewFinancials($actor);
        $assets = Asset::query()
            ->with(['assignedUser', 'location'])
            ->where('tenant_id', $actor->tenant_id)
            ->whereNotIn('status', Asset::DISPOSED_STATUSES)
            ->where(function ($q) {
                $q->whereNull('tag_number')
                    ->orWhere('tag_number', '')
                    ->orWhereIn('label_status', ['never_printed', 'unreadable', 'reprint_required']);
            })
            ->orderBy('asset_code')
            ->limit(5000)
            ->get();
        $rows = $assets->map(fn (Asset $asset) => $this->assetRow($asset, $showFinance, [
            'label_status' => $asset->label_status ?: 'missing_tag',
        ]))->all();

        return [
            'title' => 'Untagged or unreadable tags',
            'scope' => [],
            'columns' => $this->columns(['asset_tag', 'description', 'label_status', 'asset_status', 'custodian_name'], $showFinance),
            'data' => $rows,
            'totals' => ['count' => count($rows)],
            'exceptions' => $rows,
            'declaration' => null,
        ];
    }

    /**
     * @param  list<string>  $keys
     * @return list<array{key:string,label:string,type:string}>
     */
    private function columns(array $keys, bool $showFinance): array
    {
        $labels = [
            'asset_tag' => 'Tag',
            'description' => 'Description',
            'class' => 'Class',
            'serial_number' => 'Serial',
            'custodian_name' => 'Custodian',
            'location' => 'Location',
            'department' => 'Department',
            'asset_status' => 'Status',
            'register_class' => 'Register class',
            'funding_source' => 'Funding',
            'donor_name' => 'Donor',
            'site' => 'Site',
            'building' => 'Building',
            'floor' => 'Floor',
            'room' => 'Room',
            'count' => 'Count',
            'acquisition_date' => 'Acquisition date',
            'label_status' => 'Label status',
            'purchase_value' => 'Cost',
            'book_value' => 'Net book value',
        ];
        $types = [
            'count' => 'number',
            'purchase_value' => 'number',
            'book_value' => 'number',
            'acquisition_date' => 'date',
        ];
        if ($showFinance) {
            if (! in_array('purchase_value', $keys, true) && ! in_array('count', $keys, true)) {
                $keys[] = 'purchase_value';
            }
            if (! in_array('book_value', $keys, true) && ! in_array('count', $keys, true)) {
                $keys[] = 'book_value';
            }
        }

        return array_map(fn (string $key) => [
            'key' => $key,
            'label' => $labels[$key] ?? $key,
            'type' => $types[$key] ?? 'text',
        ], $keys);
    }

    /**
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    private function assetRow(Asset $asset, bool $showFinance, array $extra = []): array
    {
        $row = [
            'asset_id' => $asset->id,
            'asset_tag' => $asset->tag_number ?: $asset->asset_code,
            'description' => $asset->name,
            'class' => $asset->category ?: $asset->asset_class,
            'register_class' => $asset->asset_class ?: 'capital',
            'serial_number' => $asset->serial_number,
            'custodian_name' => $asset->assignedUser?->name,
            'location' => $asset->location?->name ?: $asset->department,
            'department' => $asset->department,
            'asset_status' => $asset->status,
            'funding_source' => $asset->funding_source,
            ...$extra,
        ];
        if ($showFinance) {
            $row['purchase_value'] = $asset->purchase_value;
            $row['book_value'] = $asset->book_value;
        }

        return $row;
    }
}
