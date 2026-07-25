<?php

namespace Tests\Feature\MAndE;

use App\Models\MeSetting;
use App\Models\Tenant;
use Tests\TestCase;

class MeSettingsTest extends TestCase
{
    public function test_defaults_and_admin_can_update(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $http->getJson('/api/v1/mande/settings')
            ->assertOk()
            ->assertJsonPath('data.auto_intake', true)
            ->assertJsonPath('data.report_due_days', 14)
            ->assertJsonPath('data.programme_manager_review', false);

        $http->putJson('/api/v1/mande/settings', [
            'auto_intake'             => false,
            'report_due_days'          => 21,
            'programme_manager_review' => true,
        ])->assertOk()
            ->assertJsonPath('data.auto_intake', false)
            ->assertJsonPath('data.report_due_days', 21)
            ->assertJsonPath('data.programme_manager_review', true);

        $this->assertDatabaseHas('me_settings', [
            'tenant_id'                => $tenant->id,
            'auto_intake'             => false,
            'report_due_days'          => 21,
            'programme_manager_review' => true,
        ]);
    }

    public function test_staff_cannot_update_settings(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $http->putJson('/api/v1/mande/settings', ['auto_intake' => false])
            ->assertForbidden();
    }
}
