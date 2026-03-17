<?php

namespace Tests\Feature\Hr;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class HrEndpointTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);
        $tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $tenant->id,
            'is_active' => true,
        ]);
        $this->user->assignRole('Staff');
    }

    public function test_authenticated_user_can_fetch_timesheets(): void
    {
        Sanctum::actingAs($this->user);

        $weekStart = now()->startOfWeek()->addWeek()->format('Y-m-d');
        $response = $this->getJson("/api/v1/hr/timesheets?week_start={$weekStart}");

        $response->assertStatus(200);
    }

    public function test_authenticated_user_can_fetch_hr_documents(): void
    {
        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/hr/documents');

        $response->assertStatus(200);
        $response->assertJsonStructure(['data']);
    }

    public function test_authenticated_user_can_list_hr_files(): void
    {
        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/hr/files');

        $response->assertStatus(200);
        $response->assertJsonStructure(['data']);
    }
}
