<?php

namespace Tests\Feature\Budget;

use App\Models\BudgetFxRate;
use App\Models\Tenant;
use App\Modules\Budget\Services\BudgetFxConversionService;
use Tests\TestCase;

class BudgetFxConversionTest extends TestCase
{
    public function test_convert_uses_latest_rate_and_identity(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);

        $http->postJson('/api/v1/budget/fx-rates', [
            'base_currency' => 'USD',
            'quote_currency' => 'NAD',
            'rate' => 18.5,
            'effective_date' => now()->subDays(10)->toDateString(),
        ])->assertCreated();

        $http->postJson('/api/v1/budget/fx-rates', [
            'base_currency' => 'USD',
            'quote_currency' => 'NAD',
            'rate' => 19.0,
            'effective_date' => now()->toDateString(),
        ])->assertCreated();

        $res = $http->postJson('/api/v1/budget/fx-rates/convert', [
            'amount' => 10,
            'from' => 'USD',
            'to' => 'NAD',
        ])->assertOk()->json('data');

        $this->assertSame(190.0, (float) $res['converted']);
        $this->assertSame(19.0, (float) $res['rate']);

        $identity = app(BudgetFxConversionService::class)
            ->convert((int) $tenant->id, 5, 'NAD', 'NAD');
        $this->assertSame(5.0, (float) $identity['converted']);
        $this->assertSame(1.0, (float) $identity['rate']);
    }

    public function test_convert_supports_inverse_rate(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        BudgetFxRate::create([
            'tenant_id' => $tenant->id,
            'base_currency' => 'NAD',
            'quote_currency' => 'USD',
            'rate' => 0.05,
            'effective_date' => now()->toDateString(),
            'source' => 'manual',
        ]);

        $res = $http->postJson('/api/v1/budget/fx-rates/convert', [
            'amount' => 100,
            'from' => 'USD',
            'to' => 'NAD',
        ])->assertOk()->json('data');

        $this->assertEqualsWithDelta(2000.0, (float) $res['converted'], 0.01);
    }

    public function test_missing_rate_returns_422(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $http->postJson('/api/v1/budget/fx-rates/convert', [
            'amount' => 1,
            'from' => 'EUR',
            'to' => 'ZAR',
        ])->assertStatus(422);
    }
}
