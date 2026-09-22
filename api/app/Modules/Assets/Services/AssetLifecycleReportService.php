<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetDisposal;
use App\Models\AssetIncident;
use App\Models\AssetMaintenanceRecord;
use App\Models\AuditLog;
use App\Models\User;
use App\Modules\Assets\Support\AssetAccess;

class AssetLifecycleReportService
{
    /**
     * @param  array<string, mixed>  $params
     * @return array{title:string,scope:array<string,mixed>,columns:list<array<string,string>>,data:list<array<string,mixed>>,totals:array<string,mixed>,exceptions:list<array<string,mixed>>,declaration:?string}
     */
    public function build(User $actor, string $reportId, array $params): array
    {
        return match ($reportId) {
            'R40' => $this->serviceDue($actor),
            'R43' => $this->unavailable($actor),
            'R44' => $this->disposalCandidates($actor),
            'R45' => $this->pendingDisposals($actor),
            'R46' => $this->disposedAndWrittenOff($actor),
            'R48' => $this->riskIncidents($actor),
            'R50' => $this->executiveDashboard($actor),
            'R52' => $this->auditTrail($actor),
            default => abort(404, 'Unknown lifecycle report.'),
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function serviceDue(User $actor): array
    {
        $showFinance = AssetAccess::canViewFinancials($actor);
        $rows = AssetMaintenanceRecord::query()
            ->with('asset')
            ->where('tenant_id', $actor->tenant_id)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->whereNotNull('scheduled_on')
            ->orderBy('scheduled_on')
            ->limit(2500)
            ->get()
            ->map(function (AssetMaintenanceRecord $row) use ($showFinance) {
                $overdue = $row->scheduled_on && $row->scheduled_on->isPast();
                $payload = [
                    'asset_id' => $row->asset_id,
                    'asset_tag' => $row->asset?->tag_number ?: $row->asset?->asset_code,
                    'description' => $row->asset?->name ?: $row->title,
                    'maintenance_type' => $row->maintenance_type,
                    'title' => $row->title,
                    'scheduled_on' => optional($row->scheduled_on)->toDateString(),
                    'status' => $overdue ? 'overdue' : $row->status,
                    'vendor' => $row->vendor,
                ];
                if ($showFinance) {
                    $payload['cost'] = $row->cost;
                }

                return $payload;
            })->all();
        $dueAssets = Asset::query()
            ->where('tenant_id', $actor->tenant_id)
            ->whereIn('status', ['service_due'])
            ->whereNotIn('id', collect($rows)->pluck('asset_id')->filter())
            ->get()
            ->map(fn (Asset $asset) => [
                'asset_id' => $asset->id,
                'asset_tag' => $asset->tag_number ?: $asset->asset_code,
                'description' => $asset->name,
                'maintenance_type' => 'preventive',
                'title' => 'Service due',
                'scheduled_on' => null,
                'status' => 'overdue',
                'vendor' => null,
            ]);
        $rows = collect($rows)->concat($dueAssets)->values()->all();

        return [
            'title' => 'Service due and overdue',
            'scope' => [],
            'columns' => $this->columns(array_values(array_filter([
                'asset_tag', 'description', 'maintenance_type', 'title', 'scheduled_on', 'status', 'vendor',
                $showFinance ? 'cost' : null,
            ]))),
            'data' => $rows,
            'totals' => [
                'count' => count($rows),
                'overdue' => collect($rows)->where('status', 'overdue')->count(),
            ],
            'exceptions' => collect($rows)->where('status', 'overdue')->values()->all(),
            'declaration' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function unavailable(User $actor): array
    {
        $showFinance = AssetAccess::canViewFinancials($actor);
        $rows = Asset::query()
            ->with(['assignedUser'])
            ->where('tenant_id', $actor->tenant_id)
            ->whereIn('status', ['under_repair', 'damaged', 'service_due', 'under_warranty_repair', 'awaiting_parts'])
            ->orderBy('asset_code')
            ->limit(5000)
            ->get()
            ->map(fn (Asset $asset) => $this->assetRow($asset, $showFinance, [
                'unavailable_reason' => $asset->status,
            ]))
            ->all();

        return [
            'title' => 'Assets unavailable',
            'scope' => [],
            'columns' => $this->columns(array_values(array_filter([
                'asset_tag', 'description', 'asset_status', 'unavailable_reason', 'custodian_name',
                $showFinance ? 'book_value' : null,
            ]))),
            'data' => $rows,
            'totals' => ['count' => count($rows)],
            'exceptions' => $rows,
            'declaration' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function disposalCandidates(User $actor): array
    {
        $showFinance = AssetAccess::canViewFinancials($actor);
        $openIds = AssetDisposal::query()
            ->where('tenant_id', $actor->tenant_id)
            ->whereNotIn('status', ['completed', 'rejected'])
            ->pluck('asset_id');
        $rows = Asset::query()
            ->where('tenant_id', $actor->tenant_id)
            ->whereNotIn('status', Asset::DISPOSED_STATUSES)
            ->where(function ($q) {
                $q->whereIn('status', ['pending_disposal', 'idle', 'damaged'])
                    ->orWhereIn('condition', ['poor', 'damaged', 'beyond_economic_repair', 'obsolete'])
                    ->orWhere(function ($q2) {
                        $q2->whereNotNull('book_value')->where('book_value', '<=', 0.01);
                    })
                    ->orWhere(function ($q2) {
                        $q2->whereNotNull('replacement_due_on')->whereDate('replacement_due_on', '<=', now());
                    });
            })
            ->orderBy('asset_code')
            ->limit(5000)
            ->get()
            ->map(fn (Asset $asset) => $this->assetRow($asset, $showFinance, [
                'candidate_reason' => $this->candidateReason($asset),
                'open_disposal' => $openIds->contains($asset->id),
            ]))
            ->all();

        return [
            'title' => 'Disposal candidates',
            'scope' => [],
            'columns' => $this->columns(array_values(array_filter([
                'asset_tag', 'description', 'class', 'asset_status', 'condition', 'candidate_reason',
                $showFinance ? 'book_value' : null,
            ]))),
            'data' => $rows,
            'totals' => ['count' => count($rows)],
            'exceptions' => $rows,
            'declaration' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function pendingDisposals(User $actor): array
    {
        $showFinance = AssetAccess::canViewFinancials($actor);
        $rows = AssetDisposal::query()
            ->with(['asset', 'requester'])
            ->where('tenant_id', $actor->tenant_id)
            ->whereNotIn('status', ['completed', 'rejected'])
            ->orderByDesc('id')
            ->get()
            ->map(fn (AssetDisposal $row) => $this->disposalRow($row, $showFinance))
            ->all();

        return [
            'title' => 'Pending disposal approvals',
            'scope' => [],
            'columns' => $this->disposalColumns($showFinance),
            'data' => $rows,
            'totals' => ['count' => count($rows)],
            'exceptions' => $rows,
            'declaration' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function disposedAndWrittenOff(User $actor): array
    {
        $showFinance = AssetAccess::canViewFinancials($actor);
        $rows = AssetDisposal::query()
            ->with(['asset', 'requester'])
            ->where('tenant_id', $actor->tenant_id)
            ->where('status', 'completed')
            ->orderByDesc('completed_at')
            ->get()
            ->map(fn (AssetDisposal $row) => $this->disposalRow($row, $showFinance))
            ->all();
        $orphans = Asset::query()
            ->where('tenant_id', $actor->tenant_id)
            ->whereIn('status', Asset::DISPOSED_STATUSES)
            ->whereNotIn('id', collect($rows)->pluck('asset_id')->filter())
            ->get()
            ->map(fn (Asset $asset) => $this->assetRow($asset, $showFinance, [
                'reference' => null,
                'method' => $asset->status,
                'reason' => 'register_status',
                'disposal_status' => $asset->status,
            ]));
        $rows = collect($rows)->concat($orphans)->values()->all();

        return [
            'title' => 'Disposed and written-off assets',
            'scope' => [],
            'columns' => $this->disposalColumns($showFinance),
            'data' => $rows,
            'totals' => ['count' => count($rows)],
            'exceptions' => [],
            'declaration' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function riskIncidents(User $actor): array
    {
        $showFinance = AssetAccess::canViewFinancials($actor);
        $incidents = AssetIncident::query()
            ->with('asset')
            ->where('tenant_id', $actor->tenant_id)
            ->whereIn('type', ['lost', 'missing', 'stolen', 'damaged'])
            ->whereNotIn('status', ['closed', 'cancelled'])
            ->orderByDesc('id')
            ->get()
            ->map(function (AssetIncident $row) use ($showFinance) {
                $payload = [
                    'incident_id' => $row->id,
                    'asset_id' => $row->asset_id,
                    'asset_tag' => $row->asset?->tag_number ?: $row->asset?->asset_code,
                    'description' => $row->asset?->name,
                    'incident_type' => $row->type,
                    'status' => $row->status,
                    'date_noticed' => optional($row->date_noticed)->toDateString(),
                    'owner' => $row->reporter_name,
                    'action' => $row->police_case_number ?: $row->circumstances,
                ];
                if ($showFinance) {
                    $payload['book_value'] = $row->asset?->book_value;
                }

                return $payload;
            });
        $statusRows = Asset::query()
            ->where('tenant_id', $actor->tenant_id)
            ->whereIn('status', ['missing', 'lost', 'stolen', 'damaged'])
            ->whereNotIn('id', $incidents->pluck('asset_id')->filter())
            ->get()
            ->map(fn (Asset $asset) => [
                'incident_id' => null,
                'asset_id' => $asset->id,
                'asset_tag' => $asset->tag_number ?: $asset->asset_code,
                'description' => $asset->name,
                'incident_type' => $asset->status,
                'status' => 'open',
                'date_noticed' => optional($asset->updated_at)->toDateString(),
                'owner' => null,
                'action' => 'status_only',
            ]);
        $rows = $incidents->concat($statusRows)->values()->all();

        return [
            'title' => 'Missing stolen or damaged assets',
            'scope' => [],
            'columns' => $this->columns(array_values(array_filter([
                'asset_tag', 'description', 'incident_type', 'status', 'date_noticed', 'owner', 'action',
                $showFinance ? 'book_value' : null,
            ]))),
            'data' => $rows,
            'totals' => ['count' => count($rows)],
            'exceptions' => $rows,
            'declaration' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function executiveDashboard(User $actor): array
    {
        $showFinance = AssetAccess::canViewFinancials($actor);
        $live = Asset::query()->where('tenant_id', $actor->tenant_id)->whereNotIn('status', Asset::DISPOSED_STATUSES);
        $all = Asset::query()->where('tenant_id', $actor->tenant_id);
        $capital = (clone $live)->where(fn ($q) => $q->where('asset_class', 'capital')->orWhereNull('asset_class')->orWhere('asset_class', ''))->count();
        $controlled = (clone $live)->where('asset_class', 'controlled')->count();
        $assigned = (clone $live)->where(fn ($q) => $q->whereNotNull('assigned_to')->orWhere('custodian_type', 'store'))->count();
        $active = (clone $live)->count();
        $verified = (clone $live)->where('verification_status', 'verified')->count();
        $rows = [
            ['indicator' => 'Total controlled assets', 'count' => $active, 'note' => $capital.' capital / '.$controlled.' controlled'],
            ['indicator' => 'Custody completeness', 'count' => $active > 0 ? round(($assigned / $active) * 100, 1) : 0, 'note' => 'Percent with custodian or store owner'],
            ['indicator' => 'Verification coverage', 'count' => $active > 0 ? round(($verified / $active) * 100, 1) : 0, 'note' => $verified.' verified'],
            ['indicator' => 'Risk exposure', 'count' => (clone $all)->whereIn('status', ['missing', 'lost', 'stolen', 'damaged'])->count(), 'note' => 'Missing, stolen or damaged'],
            ['indicator' => 'Maintenance exposure', 'count' => (clone $live)->whereIn('status', ['service_due', 'under_repair', 'under_warranty_repair'])->count(), 'note' => 'Unavailable or overdue service'],
            ['indicator' => 'Lifecycle exposure', 'count' => AssetDisposal::query()->where('tenant_id', $actor->tenant_id)->whereNotIn('status', ['completed', 'rejected'])->count(), 'note' => 'Pending disposal backlog'],
        ];
        if ($showFinance) {
            $rows[] = [
                'indicator' => 'Acquisition cost',
                'count' => round((clone $live)->sum('purchase_value'), 2),
                'note' => 'Live register cost',
            ];
            $rows[] = [
                'indicator' => 'Net book value',
                'count' => round((clone $live)->sum('book_value'), 2),
                'note' => 'Authorised financial view',
            ];
        }

        return [
            'title' => 'Executive asset dashboard',
            'scope' => [],
            'columns' => $this->columns(['indicator', 'count', 'note']),
            'data' => $rows,
            'totals' => ['count' => $active, 'capital' => $capital, 'controlled' => $controlled],
            'exceptions' => [],
            'declaration' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function auditTrail(User $actor): array
    {
        $showFinance = AssetAccess::canViewFinancials($actor);
        $hidden = AssetAccess::financialHidden();
        $logs = AuditLog::query()
            ->with('user')
            ->where('tenant_id', $actor->tenant_id)
            ->where(function ($q) {
                $q->where('event', 'like', 'assets.%')
                    ->orWhere('tags', 'like', '%assets%');
            })
            ->orderByDesc('id')
            ->limit(2500)
            ->get()
            ->map(function (AuditLog $log) use ($showFinance, $hidden) {
                $old = $log->old_values ?? [];
                $new = $log->new_values ?? [];
                if (! $showFinance) {
                    foreach ($hidden as $field) {
                        unset($old[$field], $new[$field]);
                    }
                }

                return [
                    'event_time' => optional($log->created_at)->toIso8601String(),
                    'actor' => $log->user?->name,
                    'action' => $log->event,
                    'record_type' => class_basename((string) $log->auditable_type),
                    'record_id' => $log->auditable_id,
                    'prior_value' => $old === [] ? null : json_encode($old),
                    'new_value' => $new === [] ? null : json_encode($new),
                    'source' => $log->url,
                    'correlation_id' => $log->entry_hash,
                ];
            })->all();
        $quality = $this->dataQualityExceptions($actor);

        return [
            'title' => 'Asset audit trail and data-quality exceptions',
            'scope' => [],
            'columns' => $this->columns(['event_time', 'actor', 'action', 'record_type', 'record_id', 'prior_value', 'new_value']),
            'data' => $logs,
            'totals' => ['count' => count($logs), 'data_quality' => count($quality)],
            'exceptions' => $quality,
            'declaration' => 'Audit events are append-only and cannot be edited through the application.',
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function dataQualityExceptions(User $actor): array
    {
        $assets = Asset::query()->where('tenant_id', $actor->tenant_id)->get();
        $rows = [];
        $serials = $assets->filter(fn (Asset $asset) => filled($asset->serial_number))->groupBy('serial_number');
        foreach ($serials as $serial => $group) {
            if ($group->count() > 1) {
                foreach ($group as $asset) {
                    $rows[] = ['asset_tag' => $asset->tag_number ?: $asset->asset_code, 'exception_reason' => 'duplicate_serial', 'observed_value' => $serial];
                }
            }
        }
        foreach ($assets as $asset) {
            if (blank($asset->tag_number)) {
                $rows[] = ['asset_tag' => $asset->asset_code, 'exception_reason' => 'incomplete_tag', 'observed_value' => null];
            }
            if (blank($asset->assigned_to) && ! in_array($asset->status, [...Asset::DISPOSED_STATUSES, 'pending', 'available'], true) && $asset->custodian_type !== 'store') {
                $rows[] = ['asset_tag' => $asset->tag_number ?: $asset->asset_code, 'exception_reason' => 'inconsistent_custody', 'observed_value' => $asset->status];
            }
        }

        return $rows;
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
            'asset_status' => $asset->status,
            'condition' => $asset->condition,
            'custodian_name' => $asset->assignedUser?->name,
            ...$extra,
        ];
        if ($showFinance) {
            $row['purchase_value'] = $asset->purchase_value;
            $row['book_value'] = $asset->book_value;
        }

        return $row;
    }

    /**
     * @return array<string, mixed>
     */
    private function disposalRow(AssetDisposal $row, bool $showFinance): array
    {
        $payload = [
            'asset_id' => $row->asset_id,
            'asset_tag' => $row->asset?->tag_number ?: $row->asset?->asset_code,
            'description' => $row->asset?->name,
            'reference' => $row->reference,
            'reason' => $row->reason,
            'method' => $row->method,
            'disposal_status' => $row->status,
            'owner' => $row->requester?->name,
            'approved_at' => optional($row->approved_at)->toDateTimeString(),
            'completed_at' => optional($row->completed_at)->toDateTimeString(),
        ];
        if ($showFinance) {
            $payload['estimated_value'] = $row->estimated_value;
            $payload['proceeds'] = $row->proceeds;
            $payload['book_value'] = $row->asset?->book_value;
        }

        return $payload;
    }

    /**
     * @return list<array{key:string,label:string,type:string}>
     */
    private function disposalColumns(bool $showFinance): array
    {
        return $this->columns(array_values(array_filter([
            'asset_tag', 'description', 'reference', 'reason', 'method', 'disposal_status',
            $showFinance ? 'proceeds' : null,
        ])));
    }

    private function candidateReason(Asset $asset): string
    {
        if ($asset->status === 'pending_disposal') {
            return 'pending_disposal';
        }
        if (in_array($asset->condition, ['poor', 'damaged', 'beyond_economic_repair', 'obsolete'], true)) {
            return (string) $asset->condition;
        }
        if ($asset->book_value !== null && (float) $asset->book_value <= 0.01) {
            return 'fully_depreciated';
        }

        return $asset->status;
    }

    /**
     * @param  list<string>  $keys
     * @return list<array{key:string,label:string,type:string}>
     */
    private function columns(array $keys): array
    {
        $labels = [
            'asset_tag' => 'Tag',
            'description' => 'Description',
            'class' => 'Class',
            'asset_status' => 'Status',
            'condition' => 'Condition',
            'custodian_name' => 'Custodian',
            'maintenance_type' => 'Type',
            'title' => 'Title',
            'scheduled_on' => 'Scheduled',
            'status' => 'Status',
            'vendor' => 'Vendor',
            'cost' => 'Cost',
            'unavailable_reason' => 'Reason',
            'candidate_reason' => 'Candidate reason',
            'reference' => 'Reference',
            'reason' => 'Reason',
            'method' => 'Method',
            'disposal_status' => 'Disposal status',
            'proceeds' => 'Proceeds',
            'incident_type' => 'Incident',
            'date_noticed' => 'Noticed',
            'owner' => 'Owner',
            'action' => 'Action',
            'book_value' => 'Net book value',
            'indicator' => 'Indicator',
            'count' => 'Value',
            'note' => 'Definition',
            'event_time' => 'Event time',
            'actor' => 'Actor',
            'action' => 'Action',
            'record_type' => 'Record type',
            'record_id' => 'Record ID',
            'prior_value' => 'Prior value',
            'new_value' => 'New value',
        ];
        $types = [
            'cost' => 'number',
            'book_value' => 'number',
            'proceeds' => 'number',
            'count' => 'number',
            'scheduled_on' => 'date',
            'date_noticed' => 'date',
            'event_time' => 'date',
        ];

        return array_map(fn (string $key) => [
            'key' => $key,
            'label' => $labels[$key] ?? $key,
            'type' => $types[$key] ?? 'text',
        ], $keys);
    }
}
