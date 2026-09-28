<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetAssignmentHistory;
use App\Models\AuditLog;
use App\Models\User;
use App\Modules\Assets\Reporting\AssetReportCatalogue;
use App\Modules\Assets\Support\AssetAccess;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class AssetAssignedToUserReportService
{
    /**
     * @return array<string, mixed>
     */
    public function run(User $actor, int $userId, string $mode = 'current', ?string $asOf = null): array
    {
        abort_unless($this->canViewCustodian($actor, $userId), 403, 'You cannot view this custodian report.');

        $custodian = User::query()
            ->where('tenant_id', $actor->tenant_id)
            ->whereKey($userId)
            ->firstOrFail();

        $mode = in_array($mode, ['current', 'history', 'as_of', 'temporary', 'returned', 'unresolved'], true)
            ? $mode
            : 'current';
        $asOfAt = $asOf ? Carbon::parse($asOf) : now();

        $history = AssetAssignmentHistory::query()
            ->with(['asset'])
            ->where('tenant_id', $actor->tenant_id)
            ->where('assigned_to', $custodian->id)
            ->orderByDesc('assigned_at')
            ->get()
            ->filter(fn (AssetAssignmentHistory $row) => $this->matchesMode($row, $mode, $asOfAt));

        $showFinance = AssetAccess::canViewFinancials($actor);
        $rows = $history->values()->map(fn (AssetAssignmentHistory $row) => $this->serialize($row, $showFinance))->all();
        if (in_array($mode, ['current', 'history', 'as_of'], true)) {
            $covered = $history->pluck('asset_id')->filter()->all();
            $orphans = Asset::query()
                ->where('tenant_id', $actor->tenant_id)
                ->where('assigned_to', $custodian->id)
                ->when($covered !== [], fn ($q) => $q->whereNotIn('id', $covered))
                ->whereNotIn('status', Asset::DISPOSED_STATUSES)
                ->get();
            foreach ($orphans as $asset) {
                $rows[] = $this->serializeCurrentAsset($asset, $showFinance);
            }
        }

        $runId = 'FAR-R01-'.now()->format('Ymd').'-'.Str::upper(Str::random(6));
        $params = [
            'user_id' => $custodian->id,
            'mode' => $mode,
            'as_of' => $asOfAt->toIso8601String(),
        ];

        AuditLog::record('assets.report.viewed', [
            'tenant_id' => $actor->tenant_id,
            'user_id' => $actor->id,
            'auditable_type' => User::class,
            'auditable_id' => $custodian->id,
            'new_values' => [
                'report_id' => 'R01',
                'report_run_id' => $runId,
                'parameters' => $params,
            ],
        ]);

        return [
            'run' => [
                'report_id' => 'R01',
                'report_run_id' => $runId,
                'template_version' => AssetReportCatalogue::TEMPLATE_VERSION,
                'parameters' => $params,
                'data_as_of' => $asOfAt->toIso8601String(),
                'generated_at' => now()->toIso8601String(),
                'generated_by' => [
                    'id' => $actor->id,
                    'name' => $actor->name,
                    'email' => $actor->email,
                ],
                'official' => false,
            ],
            'custodian' => [
                'id' => $custodian->id,
                'name' => $custodian->name,
                'employee_number' => $custodian->employee_number,
                'department' => $custodian->department?->name ?? $custodian->department,
            ],
            'data' => $rows,
            'totals' => [
                'count' => count($rows),
                'unacknowledged' => collect($rows)->where('acknowledgement_status', 'pending')->count(),
                'overdue' => collect($rows)->where('overdue', true)->count(),
            ],
        ];
    }

    private function canViewCustodian(User $actor, int $userId): bool
    {
        if ((int) $actor->id === $userId) {
            return true;
        }
        if ($actor->isSystemAdmin() || AssetAccess::canManage($actor)) {
            return true;
        }

        return $actor->hasAnyPermission([
            'assets.view', 'assets.admin', 'assets.manage',
            'hr.view', 'hr.admin', 'hr.files.view',
        ]);
    }

    private function matchesMode(AssetAssignmentHistory $row, string $mode, Carbon $asOf): bool
    {
        $open = $row->returned_at === null && $row->ended_at === null && $row->declined_at === null;

        return match ($mode) {
            'history' => true,
            'returned' => $row->returned_at !== null,
            'temporary' => $open && in_array((string) $row->assignment_type, ['temporary_loan', 'loan', 'temporary'], true),
            'unresolved' => $row->return_requested_at !== null || ($open && $row->acknowledged_at === null),
            'as_of' => $row->assigned_at !== null
                && $row->assigned_at->lte($asOf)
                && ($row->returned_at === null || $row->returned_at->gt($asOf))
                && ($row->ended_at === null || $row->ended_at->gt($asOf)),
            default => $open,
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(AssetAssignmentHistory $row, bool $showFinance): array
    {
        $asset = $row->asset;
        $expected = $this->expectedReturn($row);
        $payload = [
            'assignment_id' => $row->id,
            'asset_id' => $asset?->id,
            'asset_tag' => $asset?->tag_number ?: $asset?->asset_code,
            'description' => $asset?->name,
            'class' => $asset?->asset_class ?: $asset?->category,
            'make_model' => trim(($asset?->manufacturer ? $asset->manufacturer.' ' : '').(string) $asset?->model) ?: null,
            'serial_number' => $asset?->serial_number,
            'assignment_type' => $row->assignment_type ?: 'assigned',
            'issue_date' => optional($row->assigned_at)->toDateString(),
            'expected_return' => $expected,
            'location' => $asset?->department,
            'condition' => $asset?->condition,
            'acknowledgement_status' => $row->acknowledged_at ? 'acknowledged' : ($row->declined_at ? 'declined' : 'pending'),
            'last_verification' => optional($asset?->last_verified_at)->toDateString(),
            'asset_status' => $asset?->status,
            'overdue' => $expected !== null && $row->returned_at === null && $expected < now()->toDateString(),
        ];
        if ($showFinance) {
            $payload['purchase_value'] = $asset?->purchase_value;
            $payload['accumulated_depreciation'] = $asset?->accumulated_depreciation;
            $payload['book_value'] = $asset?->book_value;
        }

        return $payload;
    }

    /**
     * Current assigned_to with no history row — migrated data, not invented history.
     *
     * @return array<string, mixed>
     */
    private function serializeCurrentAsset(Asset $asset, bool $showFinance): array
    {
        $payload = [
            'assignment_id' => -1 * (int) $asset->id,
            'asset_id' => $asset->id,
            'asset_tag' => $asset->tag_number ?: $asset->asset_code,
            'description' => $asset->name,
            'class' => $asset->asset_class ?: $asset->category,
            'make_model' => trim(($asset->manufacturer ? $asset->manufacturer.' ' : '').(string) $asset->model) ?: null,
            'serial_number' => $asset->serial_number,
            'assignment_type' => 'assigned',
            'issue_date' => optional($asset->issued_at)->toDateString(),
            'expected_return' => null,
            'location' => $asset->department,
            'condition' => $asset->condition,
            'acknowledgement_status' => 'inferred',
            'last_verification' => optional($asset->last_verified_at)->toDateString(),
            'asset_status' => $asset->status,
            'overdue' => false,
        ];
        if ($showFinance) {
            $payload['purchase_value'] = $asset->purchase_value;
            $payload['accumulated_depreciation'] = $asset->accumulated_depreciation;
            $payload['book_value'] = $asset->book_value;
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
