<?php

namespace App\Modules\Fleet\Telematics;

/**
 * Last-known position from a telematics provider.
 *
 * @phpstan-type PositionArray array{
 *   device_id: string,
 *   lat: float,
 *   lng: float,
 *   recorded_at: ?string,
 *   raw?: array<string, mixed>
 * }
 */
final class TelematicsPosition
{
    /**
     * @param  array<string, mixed>|null  $raw
     */
    public function __construct(
        public readonly string $deviceId,
        public readonly float $lat,
        public readonly float $lng,
        public readonly ?string $recordedAt = null,
        public readonly ?array $raw = null,
    ) {}

    /**
     * @param  array<string, mixed>  $row
     */
    public static function fromArray(array $row): ?self
    {
        $deviceId = trim((string) ($row['device_id'] ?? $row['deviceId'] ?? $row['id'] ?? ''));
        if ($deviceId === '') {
            return null;
        }

        $lat = $row['lat'] ?? $row['latitude'] ?? $row['gps_lat'] ?? null;
        $lng = $row['lng'] ?? $row['longitude'] ?? $row['lon'] ?? $row['gps_lng'] ?? null;
        if ($lat === null || $lng === null || ! is_numeric($lat) || ! is_numeric($lng)) {
            return null;
        }

        $latF = (float) $lat;
        $lngF = (float) $lng;
        if ($latF < -90 || $latF > 90 || $lngF < -180 || $lngF > 180) {
            return null;
        }

        $recorded = $row['recorded_at'] ?? $row['timestamp'] ?? $row['gps_recorded_at'] ?? null;

        return new self(
            deviceId: $deviceId,
            lat: $latF,
            lng: $lngF,
            recordedAt: $recorded !== null ? (string) $recorded : null,
            raw: $row,
        );
    }
}
