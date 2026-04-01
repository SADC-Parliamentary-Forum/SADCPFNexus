<?php

namespace Tests\Feature\Support;

use App\Models\SupportTicket;
use App\Models\Tenant;
use Tests\TestCase;

class SupportTicketTest extends TestCase
{
    public function test_unauthenticated_cannot_list_tickets(): void
    {
        $this->getJson('/api/v1/support/tickets')->assertUnauthorized();
    }

    public function test_staff_can_create_ticket(): void
    {
        [$http, $user] = $this->asStaff();

        $response = $http->postJson('/api/v1/support/tickets', [
            'subject'     => 'Cannot log in',
            'description' => 'Password reset not working.',
            'priority'    => 'high',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('support_tickets', [
            'user_id' => $user->id,
            'status'  => 'open',
            'subject' => 'Cannot log in',
        ]);
    }

    public function test_staff_can_view_own_ticket(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $ticket = SupportTicket::create([
            'tenant_id'        => $tenant->id,
            'user_id'          => $user->id,
            'reference_number' => 'TKT-TEST-001',
            'subject'          => 'My problem',
            'status'           => 'open',
            'priority'         => 'medium',
        ]);

        $http->getJson("/api/v1/support/tickets/{$ticket->id}")->assertOk();
    }

    public function test_staff_cannot_view_another_users_ticket(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);
        $other = $this->makeUser('staff', $tenant);

        $ticket = SupportTicket::create([
            'tenant_id'        => $tenant->id,
            'user_id'          => $other->id,
            'reference_number' => 'TKT-TEST-002',
            'subject'          => 'Not yours',
            'status'           => 'open',
            'priority'         => 'medium',
        ]);

        $http->getJson("/api/v1/support/tickets/{$ticket->id}")->assertForbidden();
    }

    public function test_staff_can_update_open_ticket(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $ticket = SupportTicket::create([
            'tenant_id'        => $tenant->id,
            'user_id'          => $user->id,
            'reference_number' => 'TKT-TEST-003',
            'subject'          => 'Old subject',
            'status'           => 'open',
            'priority'         => 'low',
        ]);

        $http->putJson("/api/v1/support/tickets/{$ticket->id}", [
            'subject'  => 'Updated subject',
            'priority' => 'high',
        ])->assertOk();

        $this->assertDatabaseHas('support_tickets', [
            'id'      => $ticket->id,
            'subject' => 'Updated subject',
        ]);
    }

    public function test_staff_can_close_own_ticket(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $ticket = SupportTicket::create([
            'tenant_id'        => $tenant->id,
            'user_id'          => $user->id,
            'reference_number' => 'TKT-TEST-004',
            'subject'          => 'Resolved now',
            'status'           => 'open',
            'priority'         => 'medium',
        ]);

        $http->putJson("/api/v1/support/tickets/{$ticket->id}", [
            'status' => 'resolved',
        ])->assertOk();

        $this->assertDatabaseHas('support_tickets', [
            'id'     => $ticket->id,
            'status' => 'resolved',
        ]);
    }

    public function test_staff_cannot_edit_resolved_ticket(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $ticket = SupportTicket::create([
            'tenant_id'        => $tenant->id,
            'user_id'          => $user->id,
            'reference_number' => 'TKT-TEST-005',
            'subject'          => 'Already closed',
            'status'           => 'resolved',
            'priority'         => 'medium',
        ]);

        $http->putJson("/api/v1/support/tickets/{$ticket->id}", [
            'subject' => 'Re-open',
        ])->assertUnprocessable();
    }

    public function test_staff_can_delete_own_ticket(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $ticket = SupportTicket::create([
            'tenant_id'        => $tenant->id,
            'user_id'          => $user->id,
            'reference_number' => 'TKT-TEST-006',
            'subject'          => 'Delete me',
            'status'           => 'open',
            'priority'         => 'low',
        ]);

        $http->deleteJson("/api/v1/support/tickets/{$ticket->id}")->assertOk();
        $this->assertDatabaseMissing('support_tickets', ['id' => $ticket->id]);
    }

    public function test_requires_subject_to_create_ticket(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/support/tickets', [
            'description' => 'Missing subject',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['subject']);
    }
}
