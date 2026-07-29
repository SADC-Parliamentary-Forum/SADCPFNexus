<?php

namespace Tests\Feature\Correspondence;

use App\Models\Correspondence;
use App\Models\Tenant;
use App\Models\User;
use Tests\TestCase;

class CorrespondenceRetentionHoldTest extends TestCase
{
    private function grantRetention(User $user): void
    {
        $user->givePermissionTo([
            'correspondence.view',
            'correspondence.admin',
            'correspondence.manage-retention',
        ]);
    }

    private function makeCorrespondence(Tenant $tenant, User $user, array $extra = []): Correspondence
    {
        return Correspondence::create(array_merge([
            'tenant_id' => $tenant->id,
            'created_by' => $user->id,
            'title' => 'Retention test letter',
            'subject' => 'Retention',
            'type' => 'external',
            'direction' => 'outgoing',
            'status' => 'sent',
            'confidentiality' => 'general_official',
            'file_code' => '100',
            'signatory_code' => 'SG',
        ], $extra));
    }

    public function test_can_set_retention_schedule_and_legal_hold(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);
        $this->grantRetention($user);
        $corr = $this->makeCorrespondence($tenant, $user);

        $http->putJson("/api/v1/correspondence/letters/{$corr->id}/retention", [
            'retention_policy' => 'financial_7y',
            'retain_until' => '2033-07-29',
            'legal_hold' => true,
            'legal_hold_reason' => 'Litigation hold — matter 2026-44',
        ])->assertOk()
            ->assertJsonPath('data.legal_hold', true)
            ->assertJsonPath('data.retention_policy', 'financial_7y');

        $this->assertDatabaseHas('correspondence', [
            'id' => $corr->id,
            'legal_hold' => true,
            'retention_policy' => 'financial_7y',
        ]);
    }

    public function test_purge_blocked_when_legal_hold_active(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);
        $this->grantRetention($user);
        $corr = $this->makeCorrespondence($tenant, $user, [
            'legal_hold' => true,
            'legal_hold_reason' => 'Active hold',
            'legal_hold_set_by' => $user->id,
            'legal_hold_set_at' => now(),
            'retain_until' => now()->subYear()->toDateString(),
        ]);

        $http->postJson("/api/v1/correspondence/letters/{$corr->id}/purge")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['legal_hold']);

        $this->assertNull(Correspondence::find($corr->id)?->deleted_at);
        $this->assertNotNull(Correspondence::find($corr->id));
    }

    public function test_purge_allowed_when_retention_elapsed_and_not_held(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);
        $this->grantRetention($user);
        $corr = $this->makeCorrespondence($tenant, $user, [
            'legal_hold' => false,
            'retain_until' => now()->subDay()->toDateString(),
            'retention_policy' => 'general_3y',
        ]);

        $http->postJson("/api/v1/correspondence/letters/{$corr->id}/purge")
            ->assertOk();

        $this->assertSoftDeleted('correspondence', ['id' => $corr->id]);
    }

    public function test_release_legal_hold(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);
        $this->grantRetention($user);
        $corr = $this->makeCorrespondence($tenant, $user, [
            'legal_hold' => true,
            'legal_hold_reason' => 'Hold',
            'legal_hold_set_by' => $user->id,
            'legal_hold_set_at' => now(),
        ]);

        $http->postJson("/api/v1/correspondence/letters/{$corr->id}/release-hold")
            ->assertOk()
            ->assertJsonPath('data.legal_hold', false);

        $this->assertDatabaseHas('correspondence', [
            'id' => $corr->id,
            'legal_hold' => false,
        ]);
    }
}
