<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetAssignmentHistory;
use App\Models\AssetIncident;
use App\Models\User;
use App\Modules\Assets\Support\AssetAccess;

class AssetCustodyReportService
{
    /**
     * @param  array<string, mixed>  $params
     * @return array{title:string,scope:array<string,mixed>,columns:list<array<string,string>>,data:list<array<string,mixed>>,totals:array<string,mixed>,exceptions:list<array<string,mixed>>,declaration:?string}
     */
    public function build(User $actor, string $reportId, array $params): array
    {
        return match ($reportId) {
            'R03' => $this->byDepartment($actor, $params),
            'R04' => $this->unassigned($actor),
            'R05' => $this->overdueLoans($actor),
            'R06' => $this->pendingAcknowledgement($actor),
            'R07' => $this->returned($actor, $params),
            'R08' => $this->custodyHistory($actor, $params),
            'R09' => $this->staffClearance($actor, $params),
            'R10' => $this->sharedAndPooled($actor),
            default => abort(404, 'Unknown custody report.'),
        };
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function byDepartment(User $actor, array $params): array
    {
        $showFinance = AssetAccess::canViewFinancials($actor);
        $query = Asset::query()
            ->with(['assignedUser.department'])
            ->where('tenant_id', $actor->tenant_id)
            ->whereNotIn('status', Asset::DISPOSED_STATUSES)
            ->orderBy('department')
            ->orderBy('assigned_to');
        if (! empty($params['department'])) {
            $query->where('department', $params['department']);
        }
        $assets = $query->limit(5000)->get();
        $rows = $assets->map(fn (Asset $asset) => $this->assetRow($asset, $showFinance, [
            'department' => $asset->department ?: ($asset->assignedUser?->department?->name ?: 'Unassigned department'),
            'custodian_name' => $asset->assignedUser?->name,
            'staff_number' => $asset->assignedUser?->employee_number,
        ]))->all();

        return [
            'title' => 'Assets by department',
            'scope' => array_filter(['department' => $params['department'] ?? null]),
            'columns' => $this->columns(['department', 'custodian_name', 'staff_number', 'asset_tag', 'description', 'class', 'asset_status'], $showFinance),
            'data' => $rows,
            'totals' => [
                'count' => count($rows),
                'departments' => collect($rows)->pluck('department')->unique()->count(),
            ],
            'exceptions' => [],
            'declaration' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function unassigned(User $actor): array
    {
        $showFinance = AssetAccess::canViewFinancials($actor);
        $assets = Asset::query()
            ->where('tenant_id', $actor->tenant_id)
            ->whereIn('status', Asset::LIVE_STATUSES)
            ->whereNotIn('status', ['pending'])
            ->whereNotIn('status', Asset::DISPOSED_STATUSES)
            ->whereNull('assigned_to')
            ->whereNull('custodian_department_id')
            ->where(function ($q) {
                $q->whereNull('custodian_type')
                    ->orWhereNotIn('custodian_type', ['department', 'location', 'store', 'pool']);
            })
            ->orderBy('asset_code')
            ->limit(5000)
            ->get();
        $rows = $assets->map(fn (Asset $asset) => $this->assetRow($asset, $showFinance))->all();

        return [
            'title' => 'Unassigned active assets',
            'scope' => [],
            'columns' => $this->columns(['asset_tag', 'description', 'class', 'department', 'asset_status', 'condition'], $showFinance),
            'data' => $rows,
            'totals' => ['count' => count($rows)],
            'exceptions' => $rows,
            'declaration' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function overdueLoans(User $actor): array
    {
        $showFinance = AssetAccess::canViewFinancials($actor);
        $today = now()->toDateString();
        $history = AssetAssignmentHistory::query()
            ->with(['asset', 'assignee'])
            ->where('tenant_id', $actor->tenant_id)
            ->whereNull('returned_at')
            ->whereNull('ended_at')
            ->whereNull('declined_at')
            ->whereIn('assignment_type', ['temporary_loan', 'loan', 'temporary'])
            ->orderByDesc('assigned_at')
            ->get()
            ->filter(function (AssetAssignmentHistory $row) use ($today) {
                $expected = $this->expectedReturn($row);

                return $expected !== null && $expected < $today;
            });
        $rows = $history->values()->map(fn (AssetAssignmentHistory $row) => $this->historyRow($row, $showFinance))->all();

        return [
            'title' => 'Temporary loans overdue',
            'scope' => [],
            'columns' => $this->columns(['custodian_name', 'staff_number', 'asset_tag', 'description', 'issue_date', 'expected_return', 'asset_status'], $showFinance),
            'data' => $rows,
            'totals' => ['count' => count($rows)],
            'exceptions' => $rows,
            'declaration' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function pendingAcknowledgement(User $actor): array
    {
        $showFinance = AssetAccess::canViewFinancials($actor);
        $history = AssetAssignmentHistory::query()
            ->with(['asset', 'assignee'])
            ->where('tenant_id', $actor->tenant_id)
            ->whereNull('returned_at')
            ->whereNull('ended_at')
            ->whereNull('declined_at')
            ->whereNull('acknowledged_at')
            ->orderByDesc('assigned_at')
            ->limit(5000)
            ->get();
        $rows = $history->map(fn (AssetAssignmentHistory $row) => $this->historyRow($row, $showFinance))->all();

        return [
            'title' => 'Pending acknowledgement',
            'scope' => [],
            'columns' => $this->columns(['custodian_name', 'staff_number', 'asset_tag', 'description', 'issue_date', 'acknowledgement_status', 'asset_status'], $showFinance),
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
    private function returned(User $actor, array $params): array
    {
        $showFinance = AssetAccess::canViewFinancials($actor);
        $query = AssetAssignmentHistory::query()
            ->with(['asset', 'assignee', 'assignedBy'])
            ->where('tenant_id', $actor->tenant_id)
            ->whereNotNull('returned_at')
            ->orderByDesc('returned_at');
        if (! empty($params['user_id'])) {
            $query->where('assigned_to', (int) $params['user_id']);
        }
        if (! empty($params['from'])) {
            $query->whereDate('returned_at', '>=', $params['from']);
        }
        if (! empty($params['to'])) {
            $query->whereDate('returned_at', '<=', $params['to']);
        }
        $rows = $query->limit(5000)->get()->map(fn (AssetAssignmentHistory $row) => $this->historyRow($row, $showFinance) + [
            'returned_at' => optional($row->returned_at)->toDateString(),
            'receiving_officer' => $row->assignedBy?->name,
        ])->all();

        return [
            'title' => 'Returned assets',
            'scope' => array_filter([
                'user_id' => $params['user_id'] ?? null,
                'from' => $params['from'] ?? null,
                'to' => $params['to'] ?? null,
            ]),
            'columns' => $this->columns(['custodian_name', 'asset_tag', 'description', 'issue_date', 'returned_at', 'condition', 'receiving_officer'], $showFinance),
            'data' => $rows,
            'totals' => ['count' => count($rows)],
            'exceptions' => [],
            'declaration' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function sharedAndPooled(User $actor): array
    {
        $showFinance = AssetAccess::canViewFinancials($actor);
        $rows = Asset::query()
            ->with(['assignedUser', 'location'])
            ->where('tenant_id', $actor->tenant_id)
            ->whereNotIn('status', Asset::DISPOSED_STATUSES)
            ->whereIn('custodian_type', ['store', 'pool', 'department', 'shared', 'location'])
            ->orderBy('asset_code')
            ->limit(5000)
            ->get()
            ->map(fn (Asset $asset) => $this->assetRow($asset, $showFinance, [
                'custodian_type' => $asset->custodian_type,
                'location' => $asset->location?->name ?: $asset->department,
                'accountable_unit' => $asset->department,
            ]))
            ->all();

        return [
            'title' => 'Shared and pooled assets',
            'scope' => [],
            'columns' => $this->columns(['asset_tag', 'description', 'custodian_type', 'accountable_unit', 'location', 'asset_status'], $showFinance),
            'data' => $rows,
            'totals' => ['count' => count($rows)],
            'exceptions' => [],
            'declaration' => null,
        ];
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function custodyHistory(User $actor, array $params): array
    {
        abort_if(empty($params['user_id']) && empty($params['asset_id']), 422, 'Provide a staff member or asset.');
        $showFinance = AssetAccess::canViewFinancials($actor);
        $query = AssetAssignmentHistory::query()
            ->with(['asset', 'assignee'])
            ->where('tenant_id', $actor->tenant_id)
            ->orderByDesc('assigned_at');
        if (! empty($params['user_id'])) {
            $query->where('assigned_to', (int) $params['user_id']);
        }
        if (! empty($params['asset_id'])) {
            $query->where('asset_id', (int) $params['asset_id']);
        }
        $rows = $query->limit(5000)->get()->map(fn (AssetAssignmentHistory $row) => $this->historyRow($row, $showFinance) + [
            'returned_at' => optional($row->returned_at)->toDateString(),
            'ended_at' => optional($row->ended_at)->toDateString(),
        ])->all();

        return [
            'title' => 'Custody history',
            'scope' => array_filter([
                'user_id' => $params['user_id'] ?? null,
                'asset_id' => $params['asset_id'] ?? null,
            ]),
            'columns' => $this->columns(['custodian_name', 'staff_number', 'asset_tag', 'description', 'assignment_type', 'issue_date', 'returned_at', 'acknowledgement_status'], $showFinance),
            'data' => $rows,
            'totals' => ['count' => count($rows)],
            'exceptions' => [],
            'declaration' => null,
        ];
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function staffClearance(User $actor, array $params): array
    {
        abort_unless(! empty($params['user_id']), 422, 'Staff member is required.');
        $staff = User::query()->where('tenant_id', $actor->tenant_id)->whereKey((int) $params['user_id'])->firstOrFail();
        $assigned = app(AssetAssignedToUserReportService::class)->run($actor, $staff->id, 'current', $params['as_of'] ?? null);
        $showFinance = AssetAccess::canViewFinancials($actor);
        $assetIds = collect($assigned['data'])->pluck('asset_id')->filter()->all();
        $incidents = AssetIncident::query()
            ->with('asset')
            ->where('tenant_id', $actor->tenant_id)
            ->where(function ($q) use ($staff, $assetIds) {
                $q->where('custodian_id', $staff->id);
                if ($assetIds !== []) {
                    $q->orWhereIn('asset_id', $assetIds);
                }
            })
            ->whereNotIn('status', ['closed', 'resolved', 'recovered', 'written_off'])
            ->get()
            ->map(fn (AssetIncident $incident) => [
                'asset_id' => $incident->asset_id,
                'asset_tag' => $incident->asset?->tag_number,
                'description' => $incident->type,
                'reason' => 'open_incident',
                'status' => $incident->status,
            ])->all();
        $exceptions = [];
        foreach ($assigned['data'] as $row) {
            if (($row['acknowledgement_status'] ?? '') === 'pending') {
                $exceptions[] = $row + ['reason' => 'pending_acknowledgement'];
            }
            if (! empty($row['overdue'])) {
                $exceptions[] = $row + ['reason' => 'overdue_loan'];
            }
            if (in_array($row['asset_status'] ?? '', ['missing', 'stolen', 'damaged'], true)) {
                $exceptions[] = $row + ['reason' => $row['asset_status']];
            }
        }
        $unresolved = AssetAssignmentHistory::query()
            ->with('asset')
            ->where('tenant_id', $actor->tenant_id)
            ->where('assigned_to', $staff->id)
            ->whereNotNull('return_requested_at')
            ->whereNull('returned_at')
            ->get()
            ->map(fn (AssetAssignmentHistory $row) => $this->historyRow($row, $showFinance) + ['reason' => 'unresolved_handover'])
            ->all();

        $rows = $assigned['data'];

        return [
            'title' => 'Staff clearance',
            'scope' => [
                'staff_number' => $staff->employee_number,
                'custodian' => $staff->name,
                'department' => $staff->department?->name ?? $staff->department,
            ],
            'columns' => $this->columns(['asset_tag', 'description', 'class', 'assignment_type', 'issue_date', 'expected_return', 'acknowledgement_status', 'asset_status'], $showFinance),
            'data' => $rows,
            'totals' => [
                'count' => count($rows),
                'open_incidents' => count($incidents),
                'unresolved_handovers' => count($unresolved),
                'exceptions' => count($exceptions) + count($incidents) + count($unresolved),
            ],
            'exceptions' => array_values([...$exceptions, ...$unresolved, ...$incidents]),
            'declaration' => 'I confirm that the assets listed have been returned, transferred or otherwise accounted for, except the exceptions recorded above.',
        ];
    }

    /**
     * @param  list<string>  $keys
     * @return list<array{key:string,label:string,type:string}>
     */
    private function columns(array $keys, bool $showFinance): array
    {
        $labels = [
            'department' => 'Department',
            'custodian_name' => 'Custodian',
            'staff_number' => 'Staff number',
            'asset_tag' => 'Tag',
            'description' => 'Description',
            'class' => 'Class',
            'serial_number' => 'Serial',
            'assignment_type' => 'Assignment type',
            'issue_date' => 'Issue date',
            'expected_return' => 'Expected return',
            'returned_at' => 'Returned',
            'location' => 'Location',
            'condition' => 'Condition',
            'acknowledgement_status' => 'Acknowledgement',
            'asset_status' => 'Status',
            'custodian_type' => 'Custody type',
            'accountable_unit' => 'Accountable unit',
            'receiving_officer' => 'Receiving officer',
            'book_value' => 'Net book value',
        ];
        $types = [
            'issue_date' => 'date',
            'expected_return' => 'date',
            'returned_at' => 'date',
            'book_value' => 'number',
        ];
        if ($showFinance && ! in_array('book_value', $keys, true)) {
            $keys[] = 'book_value';
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
            'assignment_id' => null,
            'asset_id' => $asset->id,
            'asset_tag' => $asset->tag_number ?: $asset->asset_code,
            'description' => $asset->name,
            'class' => $asset->asset_class ?: $asset->category,
            'serial_number' => $asset->serial_number,
            'department' => $asset->department,
            'location' => $asset->department,
            'condition' => $asset->condition,
            'asset_status' => $asset->status,
            'assignment_type' => $asset->assigned_to ? 'assigned' : null,
            'issue_date' => optional($asset->issued_at)->toDateString(),
            'expected_return' => null,
            'acknowledgement_status' => $asset->acknowledgement_at ? 'acknowledged' : null,
            ...$extra,
        ];
        if ($showFinance) {
            $row['book_value'] = $asset->book_value;
            $row['purchase_value'] = $asset->purchase_value;
        }

        return $row;
    }

    /**
     * @return array<string, mixed>
     */
    private function historyRow(AssetAssignmentHistory $row, bool $showFinance): array
    {
        $asset = $row->asset;
        $expected = $this->expectedReturn($row);

        $payload = [
            'assignment_id' => $row->id,
            'asset_id' => $asset?->id,
            'asset_tag' => $asset?->tag_number ?: $asset?->asset_code,
            'description' => $asset?->name,
            'class' => $asset?->asset_class ?: $asset?->category,
            'serial_number' => $asset?->serial_number,
            'assignment_type' => $row->assignment_type ?: 'assigned',
            'issue_date' => optional($row->assigned_at)->toDateString(),
            'expected_return' => $expected,
            'location' => $asset?->department,
            'condition' => $asset?->condition,
            'acknowledgement_status' => $row->acknowledged_at ? 'acknowledged' : ($row->declined_at ? 'declined' : 'pending'),
            'asset_status' => $asset?->status,
            'custodian_name' => $row->assignee?->name,
            'staff_number' => $row->assignee?->employee_number,
            'overdue' => $expected !== null && $row->returned_at === null && $expected < now()->toDateString(),
        ];
        if ($showFinance) {
            $payload['book_value'] = $asset?->book_value;
            $payload['purchase_value'] = $asset?->purchase_value;
        }

        return $payload;
    }

    private function expectedReturn(AssetAssignmentHistory $row): ?string
    {
        if (is_string($row->notes) && preg_match('/expected_return:(\d{4}-\d{2}-\d{2})/', $row->notes, $m)) {
            return $m[1];
        }

        return null;
    }
}
