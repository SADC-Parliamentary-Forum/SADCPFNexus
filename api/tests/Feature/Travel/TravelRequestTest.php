<?php

namespace Tests\Feature\Travel;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TravelRequestTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);
        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);
        $this->user->assignRole('Staff');
    }

    public function test_authenticated_user_can_create_travel_request(): void
    {
        Sanctum::actingAs($this->user);

        $response = $this->postJson('/api/v1/travel/requests', [
            'purpose'             => 'Mission to workshop',
            'destination_country' => 'Zambia',
            'departure_date'      => now()->addDays(14)->format('Y-m-d'),
            'return_date'         => now()->addDays(16)->format('Y-m-d'),
            'estimated_dsa'       => 500,
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure(['data' => ['id', 'reference_number', 'status']]);
    }

    public function test_authenticated_user_can_list_travel_requests(): void
    {
        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/travel/requests');

        $response->assertStatus(200)
            ->assertJsonStructure(['data', 'current_page']);
    }
}
