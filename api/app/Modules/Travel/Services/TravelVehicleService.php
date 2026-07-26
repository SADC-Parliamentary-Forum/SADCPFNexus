<?php

namespace App\Modules\Travel\Services;

use App\Models\Asset;
use App\Models\AuditLog;
use App\Models\TravelRequest;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class TravelVehicleService
{
    public function listFleet(User $user): Collection
    {
        return Asset::query()
            ->where('tenant_id', $user->tenant_id)
            ->where(function ($q) {
                $q->whereRaw('LOWER(category) = ?', ['fleet'])
                    ->orWhere('category', 'Fleet');
            })
            ->whereIn('status', ['active', 'available', 'in_service', 'service_due'])
            ->orderBy('asset_code')
            ->get(['id', 'asset_code', 'name', 'category', 'status', 'notes']);
    }

    /**
     * @return list<array{travel_request_id:int,reference:string,message:string}>
     */
    public function detectConflicts(TravelRequest $travel, int $vehicleAssetId): array
    {
        $conflicts = [];
        $others = TravelRequest::query()
            ->where('tenant_id', $travel->tenant_id)
            ->where('vehicle_asset_id', $vehicleAssetId)
            ->where('id', '!=', $travel->id)
            ->whereNotIn('status', ['cancelled', 'withdrawn', 'rejected'])
            ->whereDate('departure_date', '<=', $travel->return_date)
            ->whereDate('return_date', '>=', $travel->departure_date)
            ->get(['id', 'reference_number', 'departure_date', 'return_date']);

        foreach ($others as $other) {
            $conflicts[] = [
                'travel_request_id' => $other->id,
                'reference' => $other->reference_number,
                'message' => "Vehicle already assigned to {$other->reference_number} ({$other->departure_date?->toDateString()} – {$other->return_date?->toDateString()}).",
            ];
        }

        return $conflicts;
    }

    public function assign(TravelRequest $travel, array $data, User $user): TravelRequest
    {
        abort_unless(
            $user->can('travel.admin-review')
                || $user->can('travel.admin')
                || $user->isSystemAdmin()
                || $user->hasAnyRole(['Administration Officer', 'System Admin']),
            403
        );

        $vehicleId = (int) $data['vehicle_asset_id'];
        $asset = Asset::where('tenant_id', $travel->tenant_id)->findOrFail($vehicleId);

        $conflicts = $this->detectConflicts($travel, $vehicleId);
        if (! empty($conflicts) && empty($data['acknowledge_conflicts'])) {
            throw ValidationException::withMessages([
                'vehicle_conflicts' => array_map(fn ($c) => $c['message'], $conflicts),
            ]);
        }

        $travel->update([
            'vehicle_asset_id' => $asset->id,
            'vehicle_assigned_at' => now(),
            'vehicle_assigned_by' => $user->id,
            'vehicle_type' => $travel->vehicle_type ?: 'sadcpf',
            'vehicle_conflict_note' => $data['conflict_resolution_note'] ?? $travel->vehicle_conflict_note,
        ]);

        AuditLog::record('travel.vehicle_assigned', [
            'auditable_type' => TravelRequest::class,
            'auditable_id' => $travel->id,
            'new_values' => [
                'vehicle_asset_id' => $asset->id,
                'asset_code' => $asset->asset_code,
                'conflicts_acknowledged' => ! empty($data['acknowledge_conflicts']),
            ],
            'tags' => 'travel,fleet',
        ]);

        return $travel->fresh(['vehicleAsset']);
    }
}
