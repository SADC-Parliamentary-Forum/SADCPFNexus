<?php

namespace Tests\Feature\Finance;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FinanceEndpointTest extends TestCase
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

    public function test_authenticated_user_can_fetch_finance_summary(): void
    {
        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/finance/summary');

        $response->assertStatus(200);
    }

    public function test_authenticated_user_can_list_advances(): void
    {
        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/finance/advances');

        $response->assertStatus(200);
        $response->assertJsonStructure(['data']);
    }

    public function test_authenticated_user_can_list_payslips(): void
    {
        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/finance/payslips');

        $response->assertStatus(200);
        $response->assertJsonStructure(['data']);
    }
}
