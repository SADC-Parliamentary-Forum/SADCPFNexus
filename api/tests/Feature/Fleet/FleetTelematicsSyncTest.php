<?php

namespace Tests\Feature\Fleet;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Tenant;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Pluggable fleet telematics: generic HTTP poll + webhook intake.
 * Does not require a named paid vendor account — fixtures / Http::fake only.
 */
class FleetTelematicsSyncTest extends TestCase
{
    private function makeFleetVehicle(Tenant $tenant, array $attrs = []): Asset
    {
        AssetCategory::firstOrCreate(
            ['tenant_id' => $tenant->id, 'code' => 'fleet'],
            ['name' => 'Fleet', 'sort_order' => 2]
        );

        return Asset::create(array_merge([
            'tenant_id' => $tenant->id,
            'asset_code' => 'FLT-'.uniqid(),
            'name' => 'Toyota Hilux',
            'category' => 'fleet',
            'status' => 'active',
        ], $attrs));
    }

    private function fixturePath(): string
    {
        $path = storage_path('app/testing/telematics-positions.json');
        if (! is_dir(dirname($path))) {
            mkdir(dirname($path), 0777, true);
        }
        file_put_contents($path, json_encode([
            'positions' => [
                [
                    'device_id' => 'DEV-100',
                    'lat' => -22.5609,
                    'lng' => 17.0658,
                    'recorded_at' => '2026-07-29T14:00:00Z',
                ],
                [
                    'device_id' => 'UNKNOWN-999',
                    'lat' => -23.0,
                    'lng' => 18.0,
                    'recorded_at' => '2026-07-29T14:00:00Z',
                ],
            ],
        ], JSON_PRETTY_PRINT));

        return $path;
    }

    public function test_generic_http_provider_maps_fixture_json_to_gps_update(): void
    {
        config([
            'fleet_telematics.driver' => 'generic_http',
            'fleet_telematics.base_url' => 'https://telematics.example.test/v1/positions',
            'fleet_telematics.api_key' => 'test-key-not-a-secret',
        ]);

        $tenant = Tenant::factory()->create();
        $vehicle = $this->makeFleetVehicle($tenant, [
            'telematics_device_id' => 'DEV-100',
        ]);

        Http::fake([
            'telematics.example.test/*' => Http::response([
                'positions' => [
                    [
                        'device_id' => 'DEV-100',
                        'lat' => -22.5609,
                        'lng' => 17.0658,
                        'recorded_at' => '2026-07-29T14:00:00Z',
                    ],
                ],
            ], 200),
        ]);

        $this->artisan('fleet:sync-telematics', ['--tenant' => $tenant->id])
            ->assertSuccessful();

        $vehicle->refresh();
        $this->assertEqualsWithDelta(-22.5609, (float) $vehicle->gps_lat, 0.0001);
        $this->assertEqualsWithDelta(17.0658, (float) $vehicle->gps_lng, 0.0001);
        $this->assertNotNull($vehicle->gps_recorded_at);
        $this->assertSame('ok', $vehicle->telematics_sync_status);
        $this->assertNotNull($vehicle->telematics_synced_at);
        $this->assertSame('generic_http', $vehicle->telematics_provider);
    }

    public function test_disabled_provider_no_ops(): void
    {
        config([
            'fleet_telematics.driver' => 'null',
            'fleet_telematics.base_url' => 'https://telematics.example.test/v1/positions',
            'fleet_telematics.api_key' => 'should-not-be-used',
        ]);

        $tenant = Tenant::factory()->create();
        $vehicle = $this->makeFleetVehicle($tenant, [
            'telematics_device_id' => 'DEV-100',
            'gps_lat' => -20.0,
            'gps_lng' => 16.0,
        ]);

        Http::fake();

        $this->artisan('fleet:sync-telematics', ['--tenant' => $tenant->id])
            ->assertSuccessful();

        $vehicle->refresh();
        $this->assertEqualsWithDelta(-20.0, (float) $vehicle->gps_lat, 0.0001);
        $this->assertEqualsWithDelta(16.0, (float) $vehicle->gps_lng, 0.0001);
        Http::assertNothingSent();
    }

    public function test_webhook_rejects_bad_token(): void
    {
        config([
            'fleet_telematics.webhook_token' => 'good-token',
            'fleet_telematics.driver' => 'http_webhook',
        ]);

        $tenant = Tenant::factory()->create();
        $this->makeFleetVehicle($tenant, ['telematics_device_id' => 'DEV-100']);

        $this->postJson('/api/v1/fleet/telematics/webhook', [
            'device_id' => 'DEV-100',
            'lat' => -22.5,
            'lng' => 17.0,
        ], [
            'Authorization' => 'Bearer bad-token',
        ])->assertUnauthorized();
    }

    public function test_webhook_accepts_valid_token_and_updates_gps(): void
    {
        config([
            'fleet_telematics.webhook_token' => 'good-token',
            'fleet_telematics.driver' => 'http_webhook',
        ]);

        $tenant = Tenant::factory()->create();
        $vehicle = $this->makeFleetVehicle($tenant, [
            'telematics_device_id' => 'DEV-100',
        ]);

        $this->postJson('/api/v1/fleet/telematics/webhook', [
            'device_id' => 'DEV-100',
            'lat' => -22.5609,
            'lng' => 17.0658,
            'recorded_at' => '2026-07-29T15:00:00Z',
        ], [
            'Authorization' => 'Bearer good-token',
        ])->assertOk();

        $vehicle->refresh();
        $this->assertEqualsWithDelta(-22.5609, (float) $vehicle->gps_lat, 0.0001);
        $this->assertEqualsWithDelta(17.0658, (float) $vehicle->gps_lng, 0.0001);
        $this->assertSame('ok', $vehicle->telematics_sync_status);
        $this->assertSame('http_webhook', $vehicle->telematics_provider);
    }

    public function test_device_id_mapping_miss_is_skipped_safely(): void
    {
        config([
            'fleet_telematics.driver' => 'generic_http',
        ]);

        $tenant = Tenant::factory()->create();
        $vehicle = $this->makeFleetVehicle($tenant, [
            'telematics_device_id' => 'DEV-100',
            'gps_lat' => null,
            'gps_lng' => null,
        ]);

        $path = $this->fixturePath();

        $this->artisan('fleet:sync-telematics', [
            '--tenant' => $tenant->id,
            '--fixture' => $path,
        ])->assertSuccessful();

        // Mapped device updated
        $vehicle->refresh();
        $this->assertEqualsWithDelta(-22.5609, (float) $vehicle->gps_lat, 0.0001);

        // Unknown device did not create a vehicle
        $this->assertSame(1, Asset::query()->where('tenant_id', $tenant->id)->where('category', 'fleet')->count());
        $this->assertFalse(
            Asset::query()->where('telematics_device_id', 'UNKNOWN-999')->exists()
        );
    }

    public function test_dry_run_does_not_persist_gps(): void
    {
        config(['fleet_telematics.driver' => 'generic_http']);

        $tenant = Tenant::factory()->create();
        $vehicle = $this->makeFleetVehicle($tenant, [
            'telematics_device_id' => 'DEV-100',
        ]);
        $path = $this->fixturePath();

        $this->artisan('fleet:sync-telematics', [
            '--tenant' => $tenant->id,
            '--fixture' => $path,
            '--dry-run' => true,
        ])->assertSuccessful();

        $vehicle->refresh();
        $this->assertNull($vehicle->gps_lat);
        $this->assertNull($vehicle->telematics_synced_at);
    }

    public function test_can_set_telematics_device_id_on_vehicle(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $vehicle = $this->makeFleetVehicle($tenant);

        $data = $this->asUser($admin)
            ->putJson("/api/v1/fleet/vehicles/{$vehicle->id}/telematics", [
                'telematics_device_id' => 'DEV-42',
            ])
            ->assertOk()
            ->json('data');

        $this->assertSame('DEV-42', $data['telematics_device_id']);
        $this->assertDatabaseHas('assets', [
            'id' => $vehicle->id,
            'telematics_device_id' => 'DEV-42',
        ]);
    }

    public function test_vehicle_show_includes_telematics_status(): void
    {
        config([
            'fleet_telematics.driver' => 'null',
            'fleet_telematics.webhook_token' => '',
        ]);

        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $vehicle = $this->makeFleetVehicle($tenant, [
            'telematics_device_id' => 'DEV-7',
        ]);

        $detail = $this->asUser($admin)
            ->getJson("/api/v1/fleet/vehicles/{$vehicle->id}")
            ->assertOk()
            ->json('data');

        $this->assertSame('DEV-7', $detail['vehicle']['telematics_device_id']);
        $this->assertArrayHasKey('telematics', $detail);
        $this->assertSame('null', $detail['telematics']['driver']);
        $this->assertFalse($detail['telematics']['enabled']);
        $this->assertFalse($detail['telematics']['webhook_configured']);
    }
}
