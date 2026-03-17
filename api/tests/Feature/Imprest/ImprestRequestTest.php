<?php

namespace Tests\Feature\Imprest;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ImprestRequestTest extends TestCase
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

    public function test_authenticated_user_can_list_imprest_requests(): void
    {
        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/imprest/requests');

        $response->assertStatus(200);
        $response->assertJsonStructure(['data', 'current_page']);
    }

    public function test_authenticated_user_can_create_imprest_request(): void
    {
        Sanctum::actingAs($this->user);

        $response = $this->postJson('/api/v1/imprest/requests', [
            'budget_line'               => 'Travel',
            'amount_requested'           => 5000,
            'currency'                   => 'USD',
            'expected_liquidation_date'  => now()->addDays(30)->format('Y-m-d'),
            'purpose'                    => 'Mission advance',
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure(['message', 'data' => ['id', 'reference_number', 'status']])
            ->assertJsonPath('data.status', 'draft');
    }
}
