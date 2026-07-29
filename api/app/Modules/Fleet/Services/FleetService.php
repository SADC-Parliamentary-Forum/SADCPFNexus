<?php

namespace App\Modules\Fleet\Services;

use App\Models\Asset;
use App\Models\FleetFuelLog;
use App\Models\FleetServiceSchedule;
use App\Models\FleetTripLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class FleetService
{
    public const VEHICLE_CATEGORIES = ['fleet', 'vehicles'];

    /**
     * @return Collection<int, Asset>
     */
    public function listVehicles(int $tenantId): Collection
    {
        return Asset::query()
            ->where('tenant_id', $tenantId)
            ->where(function ($q) {
                foreach (self::VEHICLE_CATEGORIES as $cat) {
                    $q->orWhereRaw('LOWER(category) = ?', [strtolower($cat)]);
                }
            })
            ->orderBy('asset_code')
            ->get();
    }

    public function assertFleetVehicle(Asset $asset, int $tenantId): Asset
    {
        if ((int) $asset->tenant_id !== $tenantId) {
            abort(404);
        }

        $cat = strtolower((string) $asset->category);
        if (! in_array($cat, self::VEHICLE_CATEGORIES, true)) {
            throw ValidationException::withMessages([
                'asset_id' => ['Asset is not a fleet/vehicle Fixed Asset.'],
            ]);
        }

        return $asset;
    }

    public function showVehicle(Asset $asset, int $tenantId): array
    {
        $this->assertFleetVehicle($asset, $tenantId);

        return [
            'vehicle' => $asset,
            'trips' => FleetTripLog::query()
                ->where('asset_id', $asset->id)
                ->orderByDesc('started_at')
                ->limit(50)
                ->get(),
            'fuel_logs' => FleetFuelLog::query()
                ->where('asset_id', $asset->id)
                ->orderByDesc('logged_at')
                ->limit(50)
                ->get(),
            'service_schedules' => FleetServiceSchedule::query()
                ->where('asset_id', $asset->id)
                ->orderBy('next_due_at')
                ->get(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createTrip(Asset $asset, User $user, array $data): FleetTripLog
    {
        $this->assertFleetVehicle($asset, (int) $user->tenant_id);

        $start = isset($data['start_odometer_km']) ? (int) $data['start_odometer_km'] : null;
        $end = isset($data['end_odometer_km']) ? (int) $data['end_odometer_km'] : null;
        $distance = null;
        if ($start !== null && $end !== null && $end >= $start) {
            $distance = $end - $start;
        }

        return FleetTripLog::create([
            'tenant_id' => $user->tenant_id,
            'asset_id' => $asset->id,
            'driver_user_id' => $data['driver_user_id'] ?? $user->id,
            'started_at' => $data['started_at'],
            'ended_at' => $data['ended_at'] ?? null,
            'start_odometer_km' => $start,
            'end_odometer_km' => $end,
            'distance_km' => $distance,
            'purpose' => $data['purpose'] ?? null,
            'origin' => $data['origin'] ?? null,
            'destination' => $data['destination'] ?? null,
            'notes' => $data['notes'] ?? null,
            'created_by' => $user->id,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createFuelLog(Asset $asset, User $user, array $data): FleetFuelLog
    {
        $this->assertFleetVehicle($asset, (int) $user->tenant_id);

        return FleetFuelLog::create([
            'tenant_id' => $user->tenant_id,
            'asset_id' => $asset->id,
            'logged_at' => $data['logged_at'],
            'litres' => $data['litres'],
            'cost_amount' => $data['cost_amount'] ?? null,
            'currency' => $data['currency'] ?? 'NAD',
            'odometer_km' => $data['odometer_km'] ?? null,
            'station' => $data['station'] ?? null,
            'notes' => $data['notes'] ?? null,
            'created_by' => $user->id,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createServiceSchedule(Asset $asset, User $user, array $data): FleetServiceSchedule
    {
        $this->assertFleetVehicle($asset, (int) $user->tenant_id);

        $lastAt = isset($data['last_service_at']) ? Carbon::parse($data['last_service_at']) : null;
        $lastOdo = isset($data['last_service_odometer_km']) ? (int) $data['last_service_odometer_km'] : null;
        $intervalDays = isset($data['interval_days']) ? (int) $data['interval_days'] : null;
        $intervalKm = isset($data['interval_km']) ? (int) $data['interval_km'] : null;

        $nextDueAt = $data['next_due_at'] ?? null;
        if (! $nextDueAt && $lastAt && $intervalDays) {
            $nextDueAt = $lastAt->copy()->addDays($intervalDays)->toDateString();
        }

        $nextDueOdo = $data['next_due_odometer_km'] ?? null;
        if ($nextDueOdo === null && $lastOdo !== null && $intervalKm) {
            $nextDueOdo = $lastOdo + $intervalKm;
        }

        return FleetServiceSchedule::create([
            'tenant_id' => $user->tenant_id,
            'asset_id' => $asset->id,
            'service_type' => $data['service_type'] ?? 'service',
            'interval_km' => $intervalKm,
            'interval_days' => $intervalDays,
            'last_service_at' => $lastAt?->toDateString(),
            'last_service_odometer_km' => $lastOdo,
            'next_due_at' => $nextDueAt,
            'next_due_odometer_km' => $nextDueOdo,
            'notes' => $data['notes'] ?? null,
            'created_by' => $user->id,
        ]);
    }
}
