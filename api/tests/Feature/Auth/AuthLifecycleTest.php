<?php

namespace Tests\Feature\Auth;

use App\Models\AccountAccessRequest;
use App\Models\AccountInvitation;
use App\Models\PasswordHistory;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\UserManagement\Services\UserService;
use App\Support\PasswordPolicy;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AuthLifecycleTest extends TestCase
{
    private Tenant $tenant;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'auth_lifecycle.allowed_email_domains' => ['sadcpf.org'],
            'auth_lifecycle.password_min' => 12,
            'auth_lifecycle.password_history_count' => 5,
            'auth_lifecycle.password_max_age_days' => 90,
            'auth_lifecycle.invitation_expire_hours' => 48,
        ]);

        $this->tenant = Tenant::factory()->create();
        Role::findOrCreate('System Admin', 'sanctum');
        Role::findOrCreate('staff', 'sanctum');

        $this->admin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'email' => 'admin-lifecycle@sadcpf.org',
            'password' => Hash::make('Password@123'),
            'is_active' => true,
            'account_status' => User::STATUS_ACTIVE,
            'password_changed_at' => now(),
        ]);
        $this->admin->assignRole('System Admin');
    }

    public function test_admin_invite_creates_pending_invitation_without_plaintext_password(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/admin/users', [
                'name' => 'Invitee User',
                'email' => 'invitee@sadcpf.org',
                'role' => 'staff',
                'send_welcome_email' => false,
            ]);

        $response->assertCreated()
            ->assertJsonPath('message', 'User invited successfully.')
            ->assertJsonPath('user.account_status', User::STATUS_INVITED)
            ->assertJsonPath('user.is_active', false);

        $user = User::where('email', 'invitee@sadcpf.org')->firstOrFail();
        $this->assertDatabaseHas('account_invitations', [
            'user_id' => $user->id,
            'email' => 'invitee@sadcpf.org',
            'status' => AccountInvitation::STATUS_PENDING,
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'invitee@sadcpf.org',
            'password' => 'Password@123',
            'client_type' => 'mobile',
        ])->assertStatus(422);
    }

    public function test_invitation_accept_activates_account_with_password_policy(): void
    {
        $invitee = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Pending Invitee',
            'email' => 'pending.invitee@sadcpf.org',
            'password' => Hash::make(str()->random(40)),
            'is_active' => false,
            'account_status' => User::STATUS_INVITED,
            'invited_at' => now(),
        ]);

        $plainToken = bin2hex(random_bytes(32));
        AccountInvitation::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $invitee->id,
            'invited_by_id' => $this->admin->id,
            'email' => $invitee->email,
            'token_hash' => AccountInvitation::hashToken($plainToken),
            'status' => AccountInvitation::STATUS_PENDING,
            'expires_at' => now()->addDay(),
        ]);

        $this->getJson('/api/v1/auth/invitations/'.$plainToken)
            ->assertOk()
            ->assertJsonPath('data.email', $invitee->email);

        $this->postJson('/api/v1/auth/invitations/'.$plainToken.'/activate', [
            'password' => 'weak',
            'password_confirmation' => 'weak',
        ])->assertStatus(422);

        $this->postJson('/api/v1/auth/invitations/'.$plainToken.'/activate', [
            'password' => 'PendingInvitee@123',
            'password_confirmation' => 'PendingInvitee@123',
        ])->assertStatus(422);

        $this->postJson('/api/v1/auth/invitations/'.$plainToken.'/activate', [
            'password' => 'ActivateMe@2026!',
            'password_confirmation' => 'ActivateMe@2026!',
        ])->assertOk()
            ->assertJsonPath('message', 'Account activated. You can now sign in.');

        $invitee->refresh();
        $this->assertTrue($invitee->is_active);
        $this->assertSame(User::STATUS_ACTIVE, $invitee->account_status);
        $this->assertNotNull($invitee->password_changed_at);
        $this->assertTrue(Hash::check('ActivateMe@2026!', $invitee->password));

        $this->postJson('/api/v1/auth/login', [
            'email' => $invitee->email,
            'password' => 'ActivateMe@2026!',
            'client_type' => 'mobile',
        ])->assertOk();
    }

    public function test_access_request_approve_creates_invitation(): void
    {
        $accessRequest = AccountAccessRequest::create([
            'tenant_id' => null,
            'full_name' => 'Access Candidate',
            'official_email' => 'access.candidate@sadcpf.org',
            'position_title' => 'Officer',
            'status' => AccountAccessRequest::STATUS_REQUESTED,
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/admin/access-requests/'.$accessRequest->id.'/approve', [
                'role' => 'staff',
                'review_comment' => 'Approved for onboarding',
            ]);

        $response->assertOk()
            ->assertJsonPath('message', 'Access request approved and invitation sent.')
            ->assertJsonPath('user.account_status', User::STATUS_INVITED);

        $this->assertDatabaseHas('account_access_requests', [
            'id' => $accessRequest->id,
            'status' => AccountAccessRequest::STATUS_APPROVED,
        ]);
        $this->assertDatabaseHas('users', [
            'email' => 'access.candidate@sadcpf.org',
            'account_status' => User::STATUS_INVITED,
        ]);
        $this->assertDatabaseHas('account_invitations', [
            'email' => 'access.candidate@sadcpf.org',
            'status' => AccountInvitation::STATUS_PENDING,
        ]);
    }

    public function test_password_policy_rejects_reused_password_and_records_history(): void
    {
        $user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'email' => 'history@sadcpf.org',
            'password' => Hash::make('FirstPassword@123'),
            'is_active' => true,
            'account_status' => User::STATUS_ACTIVE,
            'password_changed_at' => now()->subDays(10),
        ]);

        PasswordPolicy::applyNewPassword($user, 'SecondPassword@123');
        $user->refresh();

        $this->assertDatabaseCount('password_histories', 1);
        $this->assertTrue(Hash::check('FirstPassword@123', PasswordHistory::firstOrFail()->password));

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/v1/profile/password', [
                'current_password' => 'SecondPassword@123',
                'password' => 'FirstPassword@123',
                'password_confirmation' => 'FirstPassword@123',
            ])->assertStatus(422);

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/v1/profile/password', [
                'current_password' => 'SecondPassword@123',
                'password' => 'ThirdPassword@123',
                'password_confirmation' => 'ThirdPassword@123',
            ])->assertOk();

        $this->assertTrue(Hash::check('ThirdPassword@123', $user->fresh()->password));
        $this->assertGreaterThanOrEqual(2, PasswordHistory::where('user_id', $user->id)->count());
    }

    public function test_expired_password_forces_reset_flag_on_login(): void
    {
        $user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'email' => 'expired@sadcpf.org',
            'password' => Hash::make('Password@123'),
            'is_active' => true,
            'account_status' => User::STATUS_ACTIVE,
            'must_reset_password' => false,
            'password_changed_at' => now()->subDays(120),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'Password@123',
            'client_type' => 'mobile',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.must_reset_password', true);

        $this->assertTrue((bool) $user->fresh()->must_reset_password);
    }

    public function test_resend_invitation_supersedes_previous_token(): void
    {
        $invitee = app(UserService::class)->create([
            'name' => 'Resend Target',
            'email' => 'resend.target@sadcpf.org',
            'role' => 'staff',
            'send_welcome_email' => false,
        ], $this->admin);

        $first = AccountInvitation::where('user_id', $invitee->id)->latest('id')->firstOrFail();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/admin/users/'.$invitee->id.'/resend-invitation')
            ->assertOk()
            ->assertJsonPath('message', 'Invitation resent.');

        $this->assertSame(AccountInvitation::STATUS_SUPERSEDED, $first->fresh()->status);
        $this->assertDatabaseHas('account_invitations', [
            'user_id' => $invitee->id,
            'status' => AccountInvitation::STATUS_PENDING,
        ]);
    }
}
