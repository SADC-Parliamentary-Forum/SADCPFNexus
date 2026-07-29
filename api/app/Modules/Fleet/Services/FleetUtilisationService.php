<?php

namespace App\Modules\Fleet\Services;

use App\Models\Asset;
use App\Models\FleetBooking;
use App\Models\FleetTripLog;
use Carbon\Carbon;
use Carbon\CarbonPeriod;

class FleetUtilisationService
{
    public function report(int $tenantId, string $from, string $to): array
    {
        $fromDt = Carbon::parse($from)->startOfDay();
        $toDt = Carbon::parse($to)->endOfDay();
        if ($toDt->lt($fromDt)) {
            [$fromDt, $toDt] = [$toDt->copy()->startOfDay(), $fromDt->copy()->endOfDay()];
        }
        $totalDays = max(1, $fromDt->diffInDays($toDt) + 1);

        $vehicles = Asset::query()
            ->where('tenant_id', $tenantId)
            ->where(function ($q) {
                foreach (['fleet', 'vehicles'] as $cat) {
                    $q->orWhereRaw('LOWER(category) = ?', [$cat]);
                }
            })
            ->get(['id', 'asset_code', 'name', 'category']);

        $rows = [];
        foreach ($vehicles as $vehicle) {
            $bookings = FleetBooking::query()
                ->where('tenant_id', $tenantId)
                ->where('asset_id', $vehicle->id)
                ->where('status', '!=', FleetBooking::CANCELLED)
                ->where('starts_at', '<=', $toDt)
                ->where('ends_at', '>=', $fromDt)
                ->get(['starts_at', 'ends_at']);

            $bookedDays = $this->countBookedDays($bookings, $fromDt, $toDt);
            $km = (int) FleetTripLog::query()
                ->where('tenant_id', $tenantId)
                ->where('asset_id', $vehicle->id)
                ->where(function ($q) use ($fromDt, $toDt) {
                    $q->whereBetween('started_at', [$fromDt, $toDt])
                        ->orWhere(function ($q2) use ($fromDt, $toDt) {
                            $q2->whereNull('started_at')
                                ->whereBetween('created_at', [$fromDt, $toDt]);
                        });
                })
                ->get()
                ->sum(function (FleetTripLog $t) {
                    if ($t->distance_km !== null) {
                        return max(0, (int) $t->distance_km);
                    }
                    if ($t->end_odometer_km !== null && $t->start_odometer_km !== null) {
                        return max(0, (int) $t->end_odometer_km - (int) $t->start_odometer_km);
                    }

                    return 0;
                });

            $idleDays = max(0, $totalDays - $bookedDays);
            $util = round(($bookedDays / $totalDays) * 100, 1);

            $rows[] = [
                'asset_id' => $vehicle->id,
                'asset_tag' => $vehicle->asset_code,
                'name' => $vehicle->name,
                'booking_days' => $bookedDays,
                'idle_days' => $idleDays,
                'km_travelled' => $km,
                'utilisation_pct' => $util,
                'period_days' => $totalDays,
            ];
        }

        usort($rows, fn ($a, $b) => $b['utilisation_pct'] <=> $a['utilisation_pct']);

        return [
            'from' => $fromDt->toDateString(),
            'to' => $toDt->toDateString(),
            'vehicles' => $rows,
            'summary' => [
                'vehicle_count' => count($rows),
                'avg_utilisation_pct' => $rows ? round(array_sum(array_column($rows, 'utilisation_pct')) / count($rows), 1) : 0,
                'total_km' => array_sum(array_column($rows, 'km_travelled')),
            ],
        ];
    }

    private function countBookedDays($bookings, Carbon $fromDt, Carbon $toDt): int
    {
        $days = [];
        foreach ($bookings as $b) {
            $start = Carbon::parse($b->starts_at)->max($fromDt)->startOfDay();
            $end = Carbon::parse($b->ends_at)->min($toDt)->startOfDay();
            if ($end->lt($start)) {
                continue;
            }
            foreach (CarbonPeriod::create($start, $end) as $day) {
                $days[$day->toDateString()] = true;
            }
        }

        return count($days);
    }
}
