<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AssetRegisterClearService
{
    public const CONFIRMATION_PHRASE = 'CLEAR REGISTER';

    /**
     * Child/register tables deleted before `assets`. Catalogue tables (categories,
     * locations, numbering policies, label templates, recovery contacts) are kept.
     *
     * @var list<string>
     */
    private const REGISTER_TABLES = [
        'asset_handover_lines',
        'asset_scan_basket_items',
        'asset_kit_items',
        'asset_planner_slots',
        'asset_attestation_responses',
        'asset_scan_baskets',
        'asset_kits',
        'asset_attestation_campaigns',
        'asset_handovers',
        'asset_acquisition_batch_items',
        'asset_acquisition_batches',
        'asset_checkouts',
        'asset_transfers',
        'asset_incidents',
        'asset_timeline_events',
        'asset_condition_assessments',
        'asset_assignment_histories',
        'asset_location_histories',
        'asset_disposals',
        'asset_verification_results',
        'asset_verification_campaigns',
        'asset_maintenance_records',
        'asset_depreciation_run_lines',
        'asset_depreciation_runs',
        'asset_revaluations',
        'asset_insurance_claims',
        'asset_movements',
        'asset_label_batch_items',
        'asset_labels',
        'asset_label_batches',
        'asset_qr_tokens',
        'asset_import_discrepancies',
        'asset_import_lineage',
        'asset_import_staging',
        'asset_import_raw',
        'asset_import_batches',
        'asset_location_mappings',
        'asset_custodian_mappings',
        'asset_unregistered_finds',
        'asset_requests',
        'fleet_trip_logs',
        'fleet_fuel_logs',
        'fleet_service_schedules',
        'fleet_bookings',
        'assets',
    ];

    /**
     * @param  (callable(string, int): void)|null  $onDeleted
     * @return array{before: int, after: int, tenant_id: int|null}
     */
    public function clear(?int $tenantId, ?callable $onDeleted = null, ?User $actor = null): array
    {
        $before = Asset::query()
            ->when($tenantId !== null, fn ($q) => $q->where('tenant_id', $tenantId))
            ->count();

        DB::transaction(function () use ($tenantId, $onDeleted): void {
            $assetIds = Asset::query()
                ->when($tenantId !== null, fn ($q) => $q->where('tenant_id', $tenantId))
                ->pluck('id');
            $importBatchIds = Schema::hasTable('asset_import_batches')
                ? DB::table('asset_import_batches')
                    ->when($tenantId !== null, fn ($q) => $q->where('tenant_id', $tenantId))
                    ->pluck('id')
                : collect();

            $this->nullKeptForeignKeys($tenantId, $assetIds);

            if (Schema::hasTable('asset_labels') && Schema::hasColumn('asset_labels', 'replaced_by_label_id')) {
                $this->scoped('asset_labels', $tenantId, $assetIds, $importBatchIds)->update(['replaced_by_label_id' => null]);
            }

            if (Schema::hasTable('assets') && Schema::hasColumn('assets', 'parent_asset_id')) {
                $this->scoped('assets', $tenantId, $assetIds, $importBatchIds)->update(['parent_asset_id' => null]);
            }

            if (Schema::hasTable('attachments')) {
                $attachmentQuery = DB::table('attachments')->where('attachable_type', Asset::class);
                if ($tenantId !== null) {
                    if (Schema::hasColumn('attachments', 'tenant_id')) {
                        $attachmentQuery->where('tenant_id', $tenantId);
                    } else {
                        $attachmentQuery->whereIn('attachable_id', $assetIds);
                    }
                }
                $attachmentQuery->delete();
            }

            foreach (self::REGISTER_TABLES as $table) {
                if (! Schema::hasTable($table)) {
                    continue;
                }
                $deleted = $this->scoped($table, $tenantId, $assetIds, $importBatchIds)->delete();
                if ($deleted > 0 && $onDeleted) {
                    $onDeleted($table, $deleted);
                }
            }

            if (Schema::hasTable('asset_number_sequences')) {
                $this->scoped('asset_number_sequences', $tenantId, $assetIds, $importBatchIds)->update(['next_number' => 1]);
            }
        });

        $after = Asset::query()
            ->when($tenantId !== null, fn ($q) => $q->where('tenant_id', $tenantId))
            ->count();

        AuditLog::record('assets.register_cleared', [
            'tenant_id' => $tenantId ?? $actor?->tenant_id,
            'user_id' => $actor?->id,
            'auditable_type' => Asset::class,
            'auditable_id' => $tenantId,
            'old_values' => ['asset_count' => $before],
            'new_values' => ['asset_count' => $after],
            'tags' => ['assets', 'register'],
        ]);

        return [
            'before' => $before,
            'after' => $after,
            'tenant_id' => $tenantId,
        ];
    }

    /**
     * @param  Collection<int, int>  $assetIds
     */
    private function nullKeptForeignKeys(?int $tenantId, Collection $assetIds): void
    {
        if (Schema::hasTable('assets')) {
            foreach (['reserved_handover_id', 'acquisition_batch_id', 'source_import_batch_id'] as $column) {
                if (Schema::hasColumn('assets', $column)) {
                    $query = DB::table('assets');
                    if ($tenantId !== null) {
                        $query->where('tenant_id', $tenantId);
                    }
                    $query->update([$column => null]);
                }
            }
        }

        if (Schema::hasTable('asset_insurance_policies') && Schema::hasColumn('asset_insurance_policies', 'asset_id')) {
            $query = DB::table('asset_insurance_policies');
            if ($tenantId !== null && Schema::hasColumn('asset_insurance_policies', 'tenant_id')) {
                $query->where('tenant_id', $tenantId);
            } elseif ($tenantId !== null) {
                $query->whereIn('asset_id', $assetIds);
            }
            $query->update(['asset_id' => null]);
        }

        if (Schema::hasTable('inventory_register_entries') && Schema::hasColumn('inventory_register_entries', 'asset_id')) {
            $inventory = DB::table('inventory_register_entries');
            if ($tenantId !== null && Schema::hasColumn('inventory_register_entries', 'tenant_id')) {
                $inventory->where('tenant_id', $tenantId);
            } elseif ($tenantId !== null) {
                $inventory->whereIn('asset_id', $assetIds);
            }
            $inventory->update(['asset_id' => null]);
        }

        if (Schema::hasTable('travel_requests') && Schema::hasColumn('travel_requests', 'vehicle_asset_id')) {
            $travel = DB::table('travel_requests');
            if ($tenantId !== null && Schema::hasColumn('travel_requests', 'tenant_id')) {
                $travel->where('tenant_id', $tenantId);
            } elseif ($tenantId !== null) {
                $travel->whereIn('vehicle_asset_id', $assetIds);
            }
            $travel->update(['vehicle_asset_id' => null]);
        }
    }

    /**
     * @param  Collection<int, int>  $assetIds
     * @param  Collection<int, int>  $importBatchIds
     */
    private function scoped(string $table, ?int $tenantId, Collection $assetIds, Collection $importBatchIds)
    {
        $query = DB::table($table);
        if ($tenantId === null) {
            return $query;
        }

        if (Schema::hasColumn($table, 'tenant_id')) {
            return $query->where('tenant_id', $tenantId);
        }

        if (Schema::hasColumn($table, 'asset_id')) {
            return $query->whereIn('asset_id', $assetIds);
        }

        if (Schema::hasColumn($table, 'import_batch_id')) {
            return $query->whereIn('import_batch_id', $importBatchIds);
        }

        return $query->whereRaw('1 = 0');
    }
}
