<?php

namespace Tests\Feature\Leave;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LeaveRequestTest extends TestCase
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

    public function test_authenticated_user_can_create_leave_request(): void
    {
        Sanctum::actingAs($this->user);

        $response = $this->postJson('/api/v1/leave/requests', [
            'leave_type' => 'annual',
            'start_date' => now()->addDays(7)->format('Y-m-d'),
            'end_date'   => now()->addDays(9)->format('Y-m-d'),
            'reason'     => 'Family leave',
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure(['message', 'data' => ['id', 'reference_number', 'leave_type', 'status']])
            ->assertJsonPath('data.status', 'draft');
    }

    public function test_authenticated_user_can_list_leave_requests(): void
    {
        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/leave/requests');

        $response->assertStatus(200)
            ->assertJsonStructure(['data', 'current_page']);
    }

    public function test_authenticated_user_can_fetch_leave_balances(): void
    {
        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/leave/balances');

        $response->assertStatus(200)
            ->assertJsonStructure(['annual_balance_days', 'lil_hours_available', 'period_year']);
    }

    public function test_authenticated_user_can_submit_leave_request(): void
    {
        Sanctum::actingAs($this->user);

        $create = $this->postJson('/api/v1/leave/requests', [
            'leave_type' => 'annual',
            'start_date' => now()->addDays(7)->format('Y-m-d'),
            'end_date'   => now()->addDays(9)->format('Y-m-d'),
            'reason'     => 'Family leave',
        ]);
        $create->assertStatus(201);
        $id = $create->json('data.id');

        $response = $this->postJson("/api/v1/leave/requests/{$id}/submit");
        $response->assertStatus(200);
        $response->assertJsonPath('data.status', 'submitted');
    }
}
