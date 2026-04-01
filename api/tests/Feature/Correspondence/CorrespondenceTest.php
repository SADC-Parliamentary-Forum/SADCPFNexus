<?php

namespace Tests\Feature\Correspondence;

use App\Models\Correspondence;
use App\Models\CorrespondenceContact;
use App\Models\Tenant;
use Tests\TestCase;

class CorrespondenceTest extends TestCase
{
    private function letterPayload(array $overrides = []): array
    {
        return array_merge([
            'subject'       => 'Budget Review 2026',
            'body'          => 'Please find attached the budget review for Q1.',
            'letter_type'   => 'outgoing',
            'recipient_name'=> 'Director of Finance',
        ], $overrides);
    }

    // ─── Letters ─────────────────────────────────────────────────────────────

    public function test_unauthenticated_cannot_list_letters(): void
    {
        $this->getJson('/api/v1/correspondence/letters')->assertUnauthorized();
    }

    public function test_staff_can_create_letter(): void
    {
        [$http, $user] = $this->asStaff();

        $response = $http->postJson('/api/v1/correspondence/letters', $this->letterPayload());

        $response->assertCreated();
        $this->assertDatabaseHas('correspondences', [
            'author_id' => $user->id,
            'subject'   => 'Budget Review 2026',
        ]);
    }

    public function test_letter_requires_subject(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/correspondence/letters', [
            'body' => 'No subject here',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['subject']);
    }

    public function test_staff_can_list_letters(): void
    {
        [$http] = $this->asStaff();

        $http->getJson('/api/v1/correspondence/letters')->assertOk();
    }

    public function test_staff_can_view_letter(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $letter = Correspondence::create([
            'tenant_id'      => $tenant->id,
            'author_id'      => $user->id,
            'reference_number' => 'CORR-001',
            'subject'        => 'Test Letter',
            'body'           => 'Content here.',
            'letter_type'    => 'outgoing',
            'status'         => 'draft',
        ]);

        $http->getJson("/api/v1/correspondence/letters/{$letter->id}")->assertOk();
    }

    public function test_staff_can_update_draft_letter(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $letter = Correspondence::create([
            'tenant_id'        => $tenant->id,
            'author_id'        => $user->id,
            'reference_number' => 'CORR-002',
            'subject'          => 'Old subject',
            'body'             => 'Old body.',
            'letter_type'      => 'outgoing',
            'status'           => 'draft',
        ]);

        $http->putJson("/api/v1/correspondence/letters/{$letter->id}", [
            'subject' => 'Updated subject',
            'body'    => 'Updated body.',
        ])->assertOk();

        $this->assertDatabaseHas('correspondences', [
            'id'      => $letter->id,
            'subject' => 'Updated subject',
        ]);
    }

    // ─── Contacts ────────────────────────────────────────────────────────────

    public function test_staff_can_create_contact(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/correspondence/contacts', [
            'name'         => 'John Smith',
            'organisation' => 'Finance Ministry',
            'email'        => 'john@finance.gov',
        ])->assertCreated();
    }

    public function test_staff_can_list_contacts(): void
    {
        [$http] = $this->asStaff();

        $http->getJson('/api/v1/correspondence/contacts')->assertOk();
    }

    public function test_contact_requires_name(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/correspondence/contacts', [
            'email' => 'noname@example.com',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['name']);
    }
}
