<?php

namespace Tests\Feature\MAndE;

use App\Models\Indicator;
use App\Models\Tenant;
use Tests\TestCase;

class IndicatorTest extends TestCase
{
    public function test_staff_can_create_indicator(): void
    {
        [$http, $user] = $this->asMeOfficer();

        $http->postJson('/api/v1/mande/indicators', [
            'name' => '# of MPs trained on SRHR',
            'result_level' => 'output',
            'unit' => 'count',
            'annual_target' => 100,
            'frequency' => 'quarterly',
            'disaggregation' => ['sex', 'country'],
        ])->assertCreated()
            ->assertJsonPath('data.name', '# of MPs trained on SRHR');

        $this->assertDatabaseHas('indicators', ['result_level' => 'output', 'tenant_id' => $user->tenant_id]);
    }

    public function test_indicator_requires_name_and_result_level(): void
    {
        [$http] = $this->asMeOfficer();
        $http->postJson('/api/v1/mande/indicators', ['unit' => 'count'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'result_level']);
    }

    public function test_indicator_rejects_invalid_result_level(): void
    {
        [$http] = $this->asMeOfficer();
        $http->postJson('/api/v1/mande/indicators', [
            'name' => 'X', 'result_level' => 'banana',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['result_level']);
    }

    public function test_staff_can_update_indicator(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asMeOfficer($tenant);

        $indicator = Indicator::create([
            'tenant_id' => $tenant->id, 'name' => 'Old', 'result_level' => 'output', 'created_by' => $user->id,
        ]);

        $http->putJson("/api/v1/mande/indicators/{$indicator->id}", [
            'name' => 'Updated indicator', 'is_active' => false,
        ])->assertOk()
            ->assertJsonPath('data.name', 'Updated indicator');

        $this->assertDatabaseHas('indicators', ['id' => $indicator->id, 'is_active' => false]);
    }

    public function test_tenant_isolation_on_show(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();
        $other = $this->makeUser('staff', $tenantB);

        $indicator = Indicator::create([
            'tenant_id' => $tenantA->id, 'name' => 'A', 'result_level' => 'output', 'created_by' => $other->id,
        ]);

        [$http] = $this->asMeOfficer($tenantB);
        $http->getJson("/api/v1/mande/indicators/{$indicator->id}")->assertNotFound();
    }

    public function test_staff_can_delete_indicator(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asMeOfficer($tenant);

        $indicator = Indicator::create([
            'tenant_id' => $tenant->id, 'name' => 'Del', 'result_level' => 'output', 'created_by' => $user->id,
        ]);

        $http->deleteJson("/api/v1/mande/indicators/{$indicator->id}")->assertOk();
        $this->assertSoftDeleted('indicators', ['id' => $indicator->id]);
    }
}
