<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\Tenant;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Artisan;
use Mockery;
use Tests\TestCase;

class AssetLifecycleAlertsTest extends TestCase
{
    public function test_warranty_notice_fires_on_day_90_not_on_day_5(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $keys = [];
        $mock = Mockery::mock(NotificationService::class);
        $mock->shouldReceive('dispatch')->andReturnUsing(function (User $recipient, string $key) use (&$keys) {
            $keys[] = $recipient->id.':'.$key;
        });
        $this->app->instance(NotificationService::class, $mock);

        $ninetieth = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'W-90',
            'tag_number' => 'PF/IT/LT/090',
            'name' => 'Ninety day warranty',
            'category' => 'ICT',
            'status' => 'available',
            'warranty_expiry' => now()->addDays(90)->toDateString(),
        ]);
        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'W-5',
            'tag_number' => 'PF/IT/LT/005',
            'name' => 'Five day warranty',
            'category' => 'ICT',
            'status' => 'available',
            'warranty_expiry' => now()->addDays(5)->toDateString(),
        ]);

        $this->assertSame(0, Artisan::call('assets:notify-lifecycle-alerts'));
        $this->assertContains($admin->id.':assets.warranty_expiring', $keys);
        $this->assertSame(1, collect($keys)->filter(fn ($row) => str_ends_with($row, ':assets.warranty_expiring'))->count());
        $this->assertNotNull($ninetieth->fresh());
    }
}
