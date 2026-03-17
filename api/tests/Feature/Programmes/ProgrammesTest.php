<?php

namespace Tests\Feature\Programmes;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProgrammesTest extends TestCase
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

    public function test_authenticated_user_can_list_programmes(): void
    {
        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/programmes');

        $response->assertStatus(200);
    }
}
