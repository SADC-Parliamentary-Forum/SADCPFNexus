<?php

namespace Tests\Feature\Admin;

use App\Models\AccountInvitation;
use App\Models\AuditLog;
use App\Models\Tenant;
use App\Models\User;
use Tests\TestCase;

class UsersDeleteTest extends TestCase
{
    public function test_staff_cannot_delete_users(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);
        $target = User::factory()->create(['tenant_id' => $tenant->id]);

        $http->postJson("/api/v1/admin/users/{$target->id}/delete")->assertForbidden();
        $this->assertDatabaseHas('users', ['id' => $target->id, 'email' => $target->email]);
    }

    public function test_admin_deletes_a_user_keeping_the_row_and_releasing_the_email(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $target = User::factory()->create(['tenant_id' => $tenant->id, 'email' => 'leaver@example.org', 'is_active' => true]);
        $invitation = AccountInvitation::create([
            'tenant_id' => $tenant->id,
            'user_id' => $target->id,
            'email' => $target->email,
            'token_hash' => AccountInvitation::hashToken('tok-'.$target->id),
            'status' => AccountInvitation::STATUS_PENDING,
            'expires_at' => now()->addDay(),
        ]);
        $target->createToken('web');

        $http->postJson("/api/v1/admin/users/{$target->id}/delete", ['reason' => 'Left the organisation'])
            ->assertOk()
            ->assertJsonPath('user.account_status', User::STATUS_REMOVED);

        $target->refresh();
        $this->assertSame(User::STATUS_REMOVED, $target->account_status);
        $this->assertFalse($target->is_active);
        $this->assertSame('leaver@example.org', $target->former_email);
        $this->assertStringEndsWith('@removed.invalid', $target->email);
        $this->assertNotNull($target->removed_at);
        $this->assertNull($target->deleted_at, 'the row stays so history still resolves');
        $this->assertFalse($target->accountAllowsAuthentication());
        $this->assertSame('removed', $target->authenticationBlockReason());
        $this->assertSame(0, $target->tokens()->count());
        $this->assertSame(AccountInvitation::STATUS_REVOKED, $invitation->fresh()->status);
        $this->assertFalse(User::where('email', 'leaver@example.org')->exists(), 'the email is free for a new account');
        $this->assertTrue(AuditLog::where('event', 'user.removed')->where('auditable_id', $target->id)->exists());
    }

    public function test_deleted_users_are_hidden_from_the_user_list_unless_asked_for(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $target = User::factory()->create(['tenant_id' => $tenant->id, 'name' => 'Removed Person']);
        $http->postJson("/api/v1/admin/users/{$target->id}/delete")->assertOk();

        $ids = collect($http->getJson('/api/v1/admin/users?per_page=100')->assertOk()->json('data'))->pluck('id');
        $this->assertNotContains($target->id, $ids);

        $inactive = collect($http->getJson('/api/v1/admin/users?status=inactive&per_page=100')->json('data'))->pluck('id');
        $this->assertNotContains($target->id, $inactive);

        $removed = collect($http->getJson('/api/v1/admin/users?status=removed&per_page=100')->json('data'))->pluck('id');
        $this->assertSame([$target->id], $removed->all());
    }

    public function test_admin_cannot_delete_themselves_or_another_system_admin(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);
        $otherAdmin = User::factory()->create(['tenant_id' => $tenant->id]);
        $otherAdmin->assignRole('System Admin');

        $http->postJson("/api/v1/admin/users/{$admin->id}/delete")->assertForbidden();
        $http->postJson("/api/v1/admin/users/{$otherAdmin->id}/delete")->assertForbidden();
    }

    public function test_a_deleted_user_cannot_be_reactivated_until_restored(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $target = User::factory()->create(['tenant_id' => $tenant->id, 'email' => 'back@example.org']);
        $http->postJson("/api/v1/admin/users/{$target->id}/delete")->assertOk();

        $http->postJson("/api/v1/admin/users/{$target->id}/reactivate")->assertStatus(422);

        $http->postJson("/api/v1/admin/users/{$target->id}/restore")
            ->assertOk()
            ->assertJsonPath('user.account_status', User::STATUS_DISABLED)
            ->assertJsonPath('user.email', 'back@example.org');
        $this->assertNull($target->fresh()->former_email);

        $http->postJson("/api/v1/admin/users/{$target->id}/reactivate")->assertOk();
        $this->assertTrue($target->fresh()->accountAllowsAuthentication());
    }

    public function test_restore_is_refused_when_another_account_took_the_email(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $target = User::factory()->create(['tenant_id' => $tenant->id, 'email' => 'reused@example.org']);
        $http->postJson("/api/v1/admin/users/{$target->id}/delete")->assertOk();
        User::factory()->create(['tenant_id' => $tenant->id, 'email' => 'reused@example.org']);

        $http->postJson("/api/v1/admin/users/{$target->id}/restore")->assertStatus(422);
        $this->assertSame(User::STATUS_REMOVED, $target->fresh()->account_status);
    }

    public function test_admin_deletes_several_users_at_once_skipping_protected_accounts(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);
        $first = User::factory()->create(['tenant_id' => $tenant->id, 'email' => 'one@example.org']);
        $second = User::factory()->create(['tenant_id' => $tenant->id, 'email' => 'two@example.org']);
        $otherAdmin = User::factory()->create(['tenant_id' => $tenant->id]);
        $otherAdmin->assignRole('System Admin');
        $alreadyGone = User::factory()->create(['tenant_id' => $tenant->id]);
        $http->postJson("/api/v1/admin/users/{$alreadyGone->id}/delete")->assertOk();

        $http->postJson('/api/v1/admin/users/bulk-delete', [
            'ids' => [$first->id, $second->id, $admin->id, $otherAdmin->id, $alreadyGone->id],
            'reason' => 'Contract ended',
        ])
            ->assertOk()
            ->assertJsonPath('removed_count', 2)
            ->assertJsonPath('skipped_count', 3);

        foreach ([$first, $second] as $user) {
            $user->refresh();
            $this->assertSame(User::STATUS_REMOVED, $user->account_status);
            $this->assertSame('Contract ended', $user->status_reason);
            $this->assertTrue(AuditLog::where('event', 'user.removed')->where('auditable_id', $user->id)->exists());
        }
        $this->assertSame('one@example.org', $first->former_email);
        $this->assertTrue($admin->fresh()->accountAllowsAuthentication());
        $this->assertNotSame(User::STATUS_REMOVED, $otherAdmin->fresh()->account_status);
    }

    public function test_staff_cannot_bulk_delete_users(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);
        $target = User::factory()->create(['tenant_id' => $tenant->id]);

        $http->postJson('/api/v1/admin/users/bulk-delete', ['ids' => [$target->id]])->assertForbidden();
        $this->assertNotSame(User::STATUS_REMOVED, $target->fresh()->account_status);
    }
}
