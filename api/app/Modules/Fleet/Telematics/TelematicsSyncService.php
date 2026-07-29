<?php

namespace App\Modules\Fleet\Telematics;

use App\Models\Asset;
use App\Modules\Fleet\Contracts\TelematicsProvider;
use App\Modules\Fleet\Services\FleetService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * Maps provider positions onto fleet vehicle GPS stub fields.
 * Never auto-creates vehicles; unknown device_ids are skipped.
 */
final class TelematicsSyncService
{
    public function __construct(
        private readonly TelematicsProviderFactory $factory,
    ) {}

    /**
     * @param  array{tenant?:int|null,fixture?:string|null,dry_run?:bool}  $options
     * @return array{
     *   status: string,
     *   driver: string,
     *   updated: int,
     *   skipped: int,
     *   dry_run: bool,
     *   errors: list<string>
     * }
     */
    public function sync(array $options = []): array
    {
        $dryRun = (bool) ($options['dry_run'] ?? false);
        $fixture = isset($options['fixture']) ? trim((string) $options['fixture']) : '';
        $tenantId = isset($options['tenant']) ? (int) $options['tenant'] : null;

        $provider = $fixture !== ''
            ? $this->factory->makeFixture($fixture)
            : $this->factory->make();

        $driver = $provider->name();
        $errors = [];

        if (! $provider->isEnabled() && $fixture === '') {
            return [
                'status' => 'disabled',
                'driver' => $driver,
                'updated' => 0,
                'skipped' => 0,
                'dry_run' => $dryRun,
                'errors' => [],
            ];
        }

        $vehiclesQuery = Asset::query()
            ->whereNotNull('telematics_device_id')
            ->where('telematics_device_id', '!=', '')
            ->where(function ($q) {
                foreach (FleetService::VEHICLE_CATEGORIES as $cat) {
                    $q->orWhereRaw('LOWER(category) = ?', [strtolower($cat)]);
                }
            })
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId));

        /** @var \Illuminate\Support\Collection<int, Asset> $vehicles */
        $vehicles = $vehiclesQuery->get();
        $deviceIds = $vehicles->pluck('telematics_device_id')->filter()->unique()->values()->all();

        try {
            $positions = $provider->fetchPositions($deviceIds);
        } catch (\Throwable $e) {
            Log::warning('fleet.telematics.sync_failed', ['error' => $e->getMessage()]);
            $this->markVehiclesError($vehicles, $driver, $e->getMessage(), $dryRun);

            return [
                'status' => 'error',
                'driver' => $driver,
                'updated' => 0,
                'skipped' => 0,
                'dry_run' => $dryRun,
                'errors' => [$e->getMessage()],
            ];
        }

        $byDevice = [];
        foreach ($positions as $pos) {
            $byDevice[$pos->deviceId] = $pos;
        }

        $updated = 0;
        $skipped = 0;

        // Positions with no mapped vehicle — skip safely (never create).
        foreach ($byDevice as $deviceId => $_) {
            $mapped = $vehicles->first(
                fn (Asset $a) => (string) $a->telematics_device_id === (string) $deviceId
            );
            if (! $mapped) {
                $skipped++;
            }
        }

        foreach ($vehicles as $vehicle) {
            $deviceId = (string) $vehicle->telematics_device_id;
            $pos = $byDevice[$deviceId] ?? null;
            if ($pos === null) {
                $skipped++;
                continue;
            }

            if ($dryRun) {
                $updated++;
                continue;
            }

            $this->applyPosition($vehicle, $pos, $driver);
            $updated++;
        }

        return [
            'status' => 'ok',
            'driver' => $driver,
            'updated' => $updated,
            'skipped' => $skipped,
            'dry_run' => $dryRun,
            'errors' => $errors,
        ];
    }

    /**
     * Apply a single webhook / push position. Never creates vehicles.
     *
     * @param  array<string, mixed>  $payload
     * @return array{status: string, updated: int, message: string}
     */
    public function applyWebhookPayload(array $payload): array
    {
        $positions = TelematicsJsonParser::parse($payload);
        if ($positions === []) {
            // Also accept a bare single-position body
            $single = TelematicsPosition::fromArray($payload);
            if ($single !== null) {
                $positions = [$single];
            }
        }

        if ($positions === []) {
            return [
                'status' => 'error',
                'updated' => 0,
                'message' => 'No valid positions in webhook payload.',
            ];
        }

        $updated = 0;
        $driver = 'http_webhook';

        foreach ($positions as $pos) {
            $vehicle = Asset::query()
                ->where('telematics_device_id', $pos->deviceId)
                ->where(function ($q) {
                    foreach (FleetService::VEHICLE_CATEGORIES as $cat) {
                        $q->orWhereRaw('LOWER(category) = ?', [strtolower($cat)]);
                    }
                })
                ->first();

            if (! $vehicle) {
                // Never auto-create — skip unknown device ids.
                continue;
            }

            $this->applyPosition($vehicle, $pos, $driver);
            $updated++;
        }

        return [
            'status' => $updated > 0 ? 'ok' : 'skipped',
            'updated' => $updated,
            'message' => $updated > 0
                ? "Updated {$updated} vehicle(s)."
                : 'No mapped fleet vehicles for device_id(s); nothing created.',
        ];
    }

    /**
     * Status payload for admin / vehicle detail UI.
     *
     * @return array{
     *   driver: string,
     *   enabled: bool,
     *   webhook_configured: bool,
     *   schedule_enabled: bool,
     *   base_url_configured: bool
     * }
     */
    public function status(): array
    {
        $driver = strtolower(trim((string) config('fleet_telematics.driver', 'null')));
        if ($driver === '') {
            $driver = 'null';
        }

        $provider = $this->factory->make($driver);
        $webhook = trim((string) config('fleet_telematics.webhook_token', ''));

        return [
            'driver' => $driver,
            'enabled' => $provider->isEnabled() || $driver === 'http_webhook',
            'webhook_configured' => $webhook !== '',
            'schedule_enabled' => (bool) config('fleet_telematics.schedule_enabled', false),
            'base_url_configured' => trim((string) config('fleet_telematics.base_url', '')) !== '',
        ];
    }

    private function applyPosition(Asset $vehicle, TelematicsPosition $pos, string $driver): void
    {
        $recordedAt = $pos->recordedAt
            ? Carbon::parse($pos->recordedAt)
            : now();

        $vehicle->fill([
            'gps_lat' => $pos->lat,
            'gps_lng' => $pos->lng,
            'gps_recorded_at' => $recordedAt,
            'telematics_provider' => $driver,
            'telematics_raw_payload' => $pos->raw,
            'telematics_synced_at' => now(),
            'telematics_sync_status' => 'ok',
            'telematics_sync_error' => null,
        ]);
        $vehicle->save();
    }

    /**
     * @param  \Illuminate\Support\Collection<int, Asset>  $vehicles
     */
    private function markVehiclesError($vehicles, string $driver, string $error, bool $dryRun): void
    {
        if ($dryRun) {
            return;
        }

        foreach ($vehicles as $vehicle) {
            $vehicle->fill([
                'telematics_provider' => $driver,
                'telematics_synced_at' => now(),
                'telematics_sync_status' => 'error',
                'telematics_sync_error' => mb_substr($error, 0, 2000),
            ]);
            $vehicle->save();
        }
    }
}
