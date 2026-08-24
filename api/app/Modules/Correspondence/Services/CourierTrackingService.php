<?php

namespace App\Modules\Correspondence\Services;

use App\Models\CorrespondenceDispatch;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;

class CourierTrackingService
{
    public function refresh(CorrespondenceDispatch $dispatch): CorrespondenceDispatch
    {
        $tracking = $dispatch->tracking_number ?: $dispatch->tracking_reference;
        $url = config('correspondence.courier_tracking_url');

        if ($url && $tracking) {
            $response = Http::timeout(15)
                ->acceptJson()
                ->get(rtrim($url, '/').'/'.urlencode((string) $tracking));

            if ($response->successful()) {
                $payload = $response->json() ?: [];
                $dispatch->tracking_status = $payload['status'] ?? $payload['tracking_status'] ?? 'in_transit';
                $dispatch->tracking_payload = $payload;
                $dispatch->tracking_checked_at = now();
                $dispatch->save();

                return $dispatch->fresh();
            }
        }

        // Stub progression when no courier HTTP endpoint is configured.
        $anchor = $dispatch->dispatched_at ?: $dispatch->created_at ?: now();
        $ageHours = Carbon::parse($anchor)->diffInHours(now());
        $status = match (true) {
            $ageHours >= 72 => 'delivered',
            $ageHours >= 12 => 'in_transit',
            default => 'registered',
        };
        $dispatch->tracking_status = $status;
        $dispatch->tracking_checked_at = now();
        $dispatch->tracking_payload = [
            'mode' => 'stub',
            'tracking' => $tracking,
            'carrier' => $dispatch->courier_carrier,
            'live_carrier_proof' => false,
        ];
        $dispatch->save();

        return $dispatch->fresh();
    }
}
