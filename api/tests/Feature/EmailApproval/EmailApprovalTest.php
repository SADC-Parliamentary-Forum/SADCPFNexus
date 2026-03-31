<?php

namespace Tests\Feature\EmailApproval;

use App\Exceptions\TokenExpiredException;
use App\Exceptions\TokenUsedException;
use App\Models\ApprovalRequest;
use App\Models\SignedActionToken;
use App\Models\Tenant;
use App\Models\TravelRequest;
use App\Models\User;
use App\Services\SignedTokenService;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class EmailApprovalTest extends TestCase
{
    /**
     * Create a travel request in submitted state with an active ApprovalRequest.
     */
    private function makeSubmittedTravelRequest(User $requester, User $approver): array
    {
        $travel = TravelRequest::factory()->create([
            'tenant_id'    => $requester->tenant_id,
            'requester_id' => $requester->id,
            'status'       => 'submitted',
        ]);

        $approvalRequest = ApprovalRequest::create([
            'tenant_id'       => $requester->tenant_id,
            'approvable_id'   => $travel->id,
            'approvable_type' => TravelRequest::class,
            'requester_id'    => $requester->id,
            'current_step'    => 1,
            'status'          => 'pending',
        ]);

        return [$travel, $approvalRequest];
    }

    /**
     * Create a token pair for a given approval request + approver.
     */
    private function createTokenPair(ApprovalRequest $request, User $approver): array
    {
        Queue::fake(); // prevent actual notifications
        $service = new SignedTokenService();
        $urls = $service->createPair($request, $approver);

        // Extract token value from URL query string
        $approveToken = [];
        parse_str(parse_url($urls['approve_url'], PHP_URL_QUERY), $approveToken);
        $rejectToken = [];
        parse_str(parse_url($urls['reject_url'], PHP_URL_QUERY), $rejectToken);

        return [
            'approve_token' => $approveToken['token'] ?? null,
            'reject_token'  => $rejectToken['token']  ?? null,
            'approve_url'   => $urls['approve_url'],
            'reject_url'    => $urls['reject_url'],
        ];
    }

    // ── Preview endpoint ──────────────────────────────────────────────────────

    public function test_preview_returns_token_details_for_valid_token(): void
    {
        $tenant   = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $approver  = $this->makeAdmin($tenant);

        [, $approvalRequest] = $this->makeSubmittedTravelRequest($requester, $approver);
        $tokens = $this->createTokenPair($approvalRequest, $approver);

        $response = $this->getJson("/api/v1/email-action/preview/{$tokens['approve_token']}");

        $response->assertOk()
                 ->assertJsonStructure(['token_action', 'expires_at', 'module', 'reference', 'requester'])
                 ->assertJsonPath('token_action', 'approve');
    }

    public function test_preview_returns_404_for_nonexistent_token(): void
    {
        $this->getJson('/api/v1/email-action/preview/nonexistent_token_abc123')
             ->assertNotFound();
    }

    public function test_preview_returns_error_for_expired_token(): void
    {
        $tenant   = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $approver  = $this->makeAdmin($tenant);

        [, $approvalRequest] = $this->makeSubmittedTravelRequest($requester, $approver);

        // Create token directly with past expiry
        $token = bin2hex(random_bytes(32));
        SignedActionToken::create([
            'tenant_id'           => $tenant->id,
            'approval_request_id' => $approvalRequest->id,
            'approver_user_id'    => $approver->id,
            'token'               => $token,
            'action'              => 'approve',
            'expires_at'          => now()->subHour(),
            'used_at'             => null,
        ]);

        $this->getJson("/api/v1/email-action/preview/{$token}")
             ->assertStatus(410); // Gone — expired
    }

    public function test_preview_returns_error_for_used_token(): void
    {
        $tenant   = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $approver  = $this->makeAdmin($tenant);

        [, $approvalRequest] = $this->makeSubmittedTravelRequest($requester, $approver);

        $token = bin2hex(random_bytes(32));
        SignedActionToken::create([
            'tenant_id'           => $tenant->id,
            'approval_request_id' => $approvalRequest->id,
            'approver_user_id'    => $approver->id,
            'token'               => $token,
            'action'              => 'approve',
            'expires_at'          => now()->addHours(72),
            'used_at'             => now()->subMinute(), // already consumed
        ]);

        $this->getJson("/api/v1/email-action/preview/{$token}")
             ->assertStatus(409); // Conflict — already used
    }

    // ── Process endpoint ──────────────────────────────────────────────────────

    public function test_authenticated_approver_can_process_approve_token(): void
    {
        Queue::fake();

        $tenant   = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $approver  = $this->makeAdmin($tenant);

        [, $approvalRequest] = $this->makeSubmittedTravelRequest($requester, $approver);
        $tokens = $this->createTokenPair($approvalRequest, $approver);

        $response = $this->asUser($approver)->postJson('/api/v1/email-action/process', [
            'token'  => $tokens['approve_token'],
            'action' => 'approve',
        ]);

        $response->assertOk()
                 ->assertJsonStructure(['message', 'action']);

        // Token should now be consumed
        $this->assertDatabaseHas('signed_action_tokens', [
            'token'  => $tokens['approve_token'],
        ]);
        $consumed = SignedActionToken::where('token', $tokens['approve_token'])->first();
        $this->assertNotNull($consumed->used_at);
    }

    public function test_authenticated_approver_can_process_reject_token_with_reason(): void
    {
        Queue::fake();

        $tenant   = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $approver  = $this->makeAdmin($tenant);

        [, $approvalRequest] = $this->makeSubmittedTravelRequest($requester, $approver);
        $tokens = $this->createTokenPair($approvalRequest, $approver);

        $response = $this->asUser($approver)->postJson('/api/v1/email-action/process', [
            'token'  => $tokens['reject_token'],
            'action' => 'reject',
            'reason' => 'Mission not aligned with current budget cycle',
        ]);

        $response->assertOk();

        $consumed = SignedActionToken::where('token', $tokens['reject_token'])->first();
        $this->assertNotNull($consumed->used_at);
    }

    public function test_reject_action_requires_reason(): void
    {
        Queue::fake();

        $tenant   = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $approver  = $this->makeAdmin($tenant);

        [, $approvalRequest] = $this->makeSubmittedTravelRequest($requester, $approver);
        $tokens = $this->createTokenPair($approvalRequest, $approver);

        $this->asUser($approver)->postJson('/api/v1/email-action/process', [
            'token'  => $tokens['reject_token'],
            'action' => 'reject',
            // missing 'reason'
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['reason']);
    }

    public function test_cannot_process_another_users_token(): void
    {
        Queue::fake();

        $tenant   = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $approver  = $this->makeAdmin($tenant);
        $intruder  = $this->makeUser('staff', $tenant);

        [, $approvalRequest] = $this->makeSubmittedTravelRequest($requester, $approver);
        $tokens = $this->createTokenPair($approvalRequest, $approver);

        // Intruder tries to use approver's token
        $this->asUser($intruder)->postJson('/api/v1/email-action/process', [
            'token'  => $tokens['approve_token'],
            'action' => 'approve',
        ])->assertForbidden();
    }

    public function test_cannot_process_already_consumed_token(): void
    {
        Queue::fake();

        $tenant   = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $approver  = $this->makeAdmin($tenant);

        [, $approvalRequest] = $this->makeSubmittedTravelRequest($requester, $approver);
        $tokens = $this->createTokenPair($approvalRequest, $approver);

        // First use
        $this->asUser($approver)->postJson('/api/v1/email-action/process', [
            'token'  => $tokens['approve_token'],
            'action' => 'approve',
        ])->assertOk();

        // Second use — must fail
        $this->asUser($approver)->postJson('/api/v1/email-action/process', [
            'token'  => $tokens['approve_token'],
            'action' => 'approve',
        ])->assertStatus(409); // Conflict — already used
    }

    public function test_process_endpoint_requires_authentication(): void
    {
        $this->postJson('/api/v1/email-action/process', [
            'token'  => 'sometoken',
            'action' => 'approve',
        ])->assertUnauthorized();
    }

    // ── Web routes (Blade confirmation pages) ────────────────────────────────

    public function test_web_approve_route_renders_confirmation_page(): void
    {
        Queue::fake();

        $tenant   = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $approver  = $this->makeAdmin($tenant);

        [, $approvalRequest] = $this->makeSubmittedTravelRequest($requester, $approver);
        $tokens = $this->createTokenPair($approvalRequest, $approver);

        $response = $this->get("/email-approval/approve/{$tokens['approve_token']}");
        $response->assertOk()
                 ->assertViewIs('email-approval.confirmed');
    }

    public function test_web_reject_form_route_renders_form(): void
    {
        Queue::fake();

        $tenant   = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $approver  = $this->makeAdmin($tenant);

        [, $approvalRequest] = $this->makeSubmittedTravelRequest($requester, $approver);
        $tokens = $this->createTokenPair($approvalRequest, $approver);

        $response = $this->get("/email-approval/reject/{$tokens['reject_token']}");
        $response->assertOk()
                 ->assertViewIs('email-approval.reject-form');
    }

    public function test_web_reject_submit_requires_reason(): void
    {
        Queue::fake();

        $tenant   = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $approver  = $this->makeAdmin($tenant);

        [, $approvalRequest] = $this->makeSubmittedTravelRequest($requester, $approver);
        $tokens = $this->createTokenPair($approvalRequest, $approver);

        // Post to the reject.submit route without a reason
        $response = $this->post("/email-approval/reject/{$tokens['reject_token']}", []);
        // Should re-show form with error, not 200 OK
        $this->assertNotEquals(200, $response->getStatusCode());
    }

    public function test_web_approve_route_shows_error_for_expired_token(): void
    {
        $token = bin2hex(random_bytes(32));

        $tenant   = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $approver  = $this->makeAdmin($tenant);

        $travel = TravelRequest::factory()->create([
            'tenant_id'    => $tenant->id,
            'requester_id' => $requester->id,
            'status'       => 'submitted',
        ]);
        $approvalRequest = ApprovalRequest::create([
            'tenant_id'       => $tenant->id,
            'approvable_id'   => $travel->id,
            'approvable_type' => TravelRequest::class,
            'requester_id'    => $requester->id,
            'current_step'    => 1,
            'status'          => 'pending',
        ]);

        SignedActionToken::create([
            'tenant_id'           => $tenant->id,
            'approval_request_id' => $approvalRequest->id,
            'approver_user_id'    => $approver->id,
            'token'               => $token,
            'action'              => 'approve',
            'expires_at'          => now()->subHour(),
        ]);

        $response = $this->get("/email-approval/approve/{$token}");
        $response->assertOk()
                 ->assertViewIs('email-approval.error');
    }
}
