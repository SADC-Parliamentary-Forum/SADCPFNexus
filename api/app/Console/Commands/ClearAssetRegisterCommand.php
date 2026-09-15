<?php

namespace App\Console\Commands;

use App\Models\Asset;
use App\Models\AuditLog;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ClearAssetRegisterCommand extends Command
{
    protected $signature = 'assets:clear-register
        {--tenant= : Tenant id (default: all tenants)}
        {--force : Permanently delete register rows without prompting}';

    protected $description = 'Delete asset register rows (assets, custody, imports, labels) while keeping categories, locations, and numbering policies for a fresh bulk upload';

    /**
     * Child/register tables deleted before `assets`. Catalogue tables are not listed.
     *
     * @var list<string>
     */
    private const REGISTER_TABLES = [
        'asset_handover_lines',
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

    public function handle(): int
    {
        if (! $this->option('force')) {
            $this->error('Refusing to delete the asset register without --force.');

            return self::FAILURE;
        }

        $tenantId = $this->option('tenant') !== null && $this->option('tenant') !== ''
            ? (int) $this->option('tenant')
            : null;

        $before = Asset::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->count();

        DB::transaction(function () use ($tenantId): void {
            $assetIds = Asset::query()
                ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
                ->pluck('id');

            $this->nullKeptForeignKeys($tenantId, $assetIds);

            if (Schema::hasTable('asset_labels') && Schema::hasColumn('asset_labels', 'replaced_by_label_id')) {
                $this->scoped('asset_labels', $tenantId, $assetIds)->update(['replaced_by_label_id' => null]);
            }

            if (Schema::hasTable('attachments')) {
                $attachmentQuery = DB::table('attachments')->where('attachable_type', Asset::class);
                if ($tenantId) {
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
                $deleted = $this->scoped($table, $tenantId, $assetIds)->delete();
                if ($deleted > 0) {
                    $this->line("Deleted {$deleted} row(s) from {$table}");
                }
            }

            if (Schema::hasTable('asset_number_sequences')) {
                $this->scoped('asset_number_sequences', $tenantId, $assetIds)->update(['next_number' => 1]);
            }
        });

        $after = Asset::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->count();

        AuditLog::record('assets.register_cleared', [
            'tenant_id' => $tenantId,
            'auditable_type' => Asset::class,
            'auditable_id' => $tenantId,
            'old_values' => ['asset_count' => $before],
            'new_values' => ['asset_count' => $after],
            'tags' => ['assets', 'register'],
        ]);

        $this->info("Asset register cleared. Assets remaining: {$after} (was {$before}). Categories and locations were kept.");

        return self::SUCCESS;
    }

    /**
     * @param  \Illuminate\Support\Collection<int, int>  $assetIds
     */
    private function nullKeptForeignKeys(?int $tenantId, $assetIds): void
    {
        if (Schema::hasTable('assets')) {
            foreach (['reserved_handover_id', 'acquisition_batch_id', 'source_import_batch_id'] as $column) {
                if (Schema::hasColumn('assets', $column)) {
                    $this->scoped('assets', $tenantId, $assetIds)->update([$column => null]);
                }
            }
        }

        if (Schema::hasTable('asset_insurance_policies') && Schema::hasColumn('asset_insurance_policies', 'asset_id')) {
            $this->scoped('asset_insurance_policies', $tenantId, $assetIds)->update(['asset_id' => null]);
        }

        if (Schema::hasTable('inventory_register_entries') && Schema::hasColumn('inventory_register_entries', 'asset_id')) {
            $inventory = DB::table('inventory_register_entries');
            if ($tenantId && Schema::hasColumn('inventory_register_entries', 'tenant_id')) {
                $inventory->where('tenant_id', $tenantId);
            } elseif ($tenantId) {
                $inventory->whereIn('asset_id', $assetIds);
            }
            $inventory->update(['asset_id' => null]);
        }

        if (Schema::hasTable('travel_requests') && Schema::hasColumn('travel_requests', 'vehicle_asset_id')) {
            $travel = DB::table('travel_requests');
            if ($tenantId && Schema::hasColumn('travel_requests', 'tenant_id')) {
                $travel->where('tenant_id', $tenantId);
            } elseif ($tenantId) {
                $travel->whereIn('vehicle_asset_id', $assetIds);
            }
            $travel->update(['vehicle_asset_id' => null]);
        }
    }

    /**
     * @param  \Illuminate\Support\Collection<int, int>  $assetIds
     */
    private function scoped(string $table, ?int $tenantId, $assetIds)
    {
        $query = DB::table($table);
        if (! $tenantId) {
            return $query;
        }

        if (Schema::hasColumn($table, 'tenant_id')) {
            return $query->where('tenant_id', $tenantId);
        }

        if (Schema::hasColumn($table, 'asset_id')) {
            return $query->whereIn('asset_id', $assetIds);
        }

        $this->warn("Skipping {$table}: no tenant_id or asset_id column for --tenant scope.");

        return $query->whereRaw('1 = 0');
    }
}
