<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetMaintenanceRecord;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AssetMaintenanceService
{
    public function create(Asset $asset, array $data, User $user): AssetMaintenanceRecord
    {
        if ((int) $asset->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        $underWarranty = false;
        if ($asset->warranty_expiry && $asset->warranty_expiry->isFuture()) {
            $underWarranty = true;
        }
        if (array_key_exists('under_warranty', $data)) {
            $underWarranty = (bool) $data['under_warranty'];
        }

        return DB::transaction(function () use ($asset, $data, $user, $underWarranty) {
            $record = AssetMaintenanceRecord::create([
                'tenant_id' => $asset->tenant_id,
                'asset_id' => $asset->id,
                'maintenance_type' => $data['maintenance_type'] ?? ($underWarranty ? 'warranty' : 'corrective'),
                'status' => $data['status'] ?? 'open',
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'scheduled_on' => $data['scheduled_on'] ?? null,
                'completed_on' => $data['completed_on'] ?? null,
                'cost' => $data['cost'] ?? null,
                'vendor' => $data['vendor'] ?? null,
                'under_warranty' => $underWarranty,
                'recorded_by' => $user->id,
            ]);

            if (($data['status'] ?? 'open') === 'in_progress') {
                $asset->status = $underWarranty ? 'under_warranty_repair' : 'service_due';
                $asset->save();
            }

            AuditLog::record('assets.maintenance_created', [
                'auditable_type' => AssetMaintenanceRecord::class,
                'auditable_id' => $record->id,
                'tags' => 'assets',
            ]);

            return $record->fresh();
        });
    }

    public function complete(AssetMaintenanceRecord $record, User $user, array $data = []): AssetMaintenanceRecord
    {
        if ((int) $record->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        if ($record->status === 'completed') {
            throw ValidationException::withMessages(['status' => 'Already completed.']);
        }

        return DB::transaction(function () use ($record, $data) {
            $record->status = 'completed';
            $record->completed_on = $data['completed_on'] ?? now()->toDateString();
            if (isset($data['cost'])) {
                $record->cost = $data['cost'];
            }
            $record->save();

            $asset = $record->asset;
            if (in_array($asset->status, ['service_due', 'under_warranty_repair'], true)) {
                $asset->status = $asset->assigned_to ? 'assigned' : 'available';
                $asset->save();
            }

            return $record->fresh();
        });
    }
}
