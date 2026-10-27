<?php

namespace Tests\Feature\Infrastructure;

use App\Models\ApprovalRequest;
use App\Models\IdempotencyRecord;
use App\Models\Payslip;
use App\Models\SalaryAdvanceRequest;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\SalaryAdvancePolicySeeder;
use Tests\TestCase;

/**
 * EnforceIdempotencyKey through the real endpoints the mobile offline sync
 * uses: a retried create or submit after a lost response must replay the
 * first outcome instead of writing a second record.
 */
class IdempotencyKeyTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SalaryAdvancePolicySeeder::class);
    }

    private function payslip(User $user): void
    {
        Payslip::create([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'period_month' => 6,
            'period_year' => 2026,
            'gross_amount' => 15000,
            'net_amount' => 10000,
            'currency' => 'NAD',
            'confirmation_status' => 'confirmed',
            'confirmed_at' => now(),
            'confirmed_by' => $user->id,
        ]);
    }

    private function advance(array $overrides = []): array
    {
        return $overrides + [
            'advance_type' => 'medical',
            'amount' => 1000,
            'currency' => 'NAD',
            'purpose' => 'Idempotency test',
            'justification' => 'Retried offline sync',
            'repayment_months' => 1,
        ];
    }

    public function test_retried_create_with_the_same_key_replays_instead_of_duplicating(): void
    {
        [$http, $user] = $this->asStaff(Tenant::factory()->create());
        $this->payslip($user);
        $headers = ['Idempotency-Key' => 'op-1:create'];

        $first = $http->postJson('/api/v1/finance/advances', $this->advance(), $headers)->assertSuccessful();
        $retry = $http->postJson('/api/v1/finance/advances', $this->advance(), $headers)->assertSuccessful();

        $this->assertSame($first->json('data.id'), $retry->json('data.id'));
        $this->assertSame('true', $retry->headers->get('Idempotent-Replayed'));
        $this->assertSame(1, SalaryAdvanceRequest::where('requester_id', $user->id)->count());
    }

    public function test_reusing_a_key_for_a_different_request_is_rejected(): void
    {
        [$http, $user] = $this->asStaff(Tenant::factory()->create());
        $this->payslip($user);
        $headers = ['Idempotency-Key' => 'op-2:create'];

        $http->postJson('/api/v1/finance/advances', $this->advance(), $headers)->assertSuccessful();
        $http->postJson('/api/v1/finance/advances', $this->advance(['amount' => 2000]), $headers)
            ->assertStatus(422)
            ->assertJsonPath('message', 'This Idempotency-Key was already used for a different request.');

        $this->assertSame(1, SalaryAdvanceRequest::where('requester_id', $user->id)->count());
    }

    public function test_a_failed_request_does_not_consume_the_key(): void
    {
        [$http, $user] = $this->asStaff(Tenant::factory()->create());
        $this->payslip($user);
        $headers = ['Idempotency-Key' => 'op-3:create'];

        $http->postJson('/api/v1/finance/advances', $this->advance(['amount' => null]), $headers)->assertStatus(422);
        $this->assertSame(0, IdempotencyRecord::where('idempotency_key', 'op-3:create')->count());

        // Corrected draft, same operation: accepted.
        $http->postJson('/api/v1/finance/advances', $this->advance(), $headers)->assertSuccessful();
        $this->assertSame(1, SalaryAdvanceRequest::where('requester_id', $user->id)->count());
    }

    public function test_submit_retried_after_a_lost_response_runs_once(): void
    {
        [$http, $user] = $this->asStaff(Tenant::factory()->create());
        $this->payslip($user);

        $id = $http->postJson('/api/v1/finance/advances', $this->advance(), ['Idempotency-Key' => 'op-4:create'])
            ->assertSuccessful()
            ->json('data.id');

        $submitHeaders = ['Idempotency-Key' => 'op-4:submit'];
        $body = ['deduction_authority_confirmed' => true];
        $first = $http->postJson("/api/v1/finance/advances/{$id}/submit", $body, $submitHeaders)->assertSuccessful();
        $approvalsAfterFirst = ApprovalRequest::where('approvable_id', $id)->count();

        $retry = $http->postJson("/api/v1/finance/advances/{$id}/submit", $body, $submitHeaders)->assertSuccessful();

        $this->assertSame('true', $retry->headers->get('Idempotent-Replayed'));
        $this->assertSame($first->json(), $retry->json());
        $this->assertSame($approvalsAfterFirst, ApprovalRequest::where('approvable_id', $id)->count());
    }

    public function test_keys_are_scoped_per_user(): void
    {
        $tenant = Tenant::factory()->create();
        [$httpA, $userA] = $this->asStaff($tenant);
        $this->payslip($userA);
        $httpA->postJson('/api/v1/finance/advances', $this->advance(), ['Idempotency-Key' => 'shared-key'])->assertSuccessful();

        [$httpB, $userB] = $this->asStaff($tenant);
        $this->payslip($userB);
        $responseB = $httpB->postJson('/api/v1/finance/advances', $this->advance(), ['Idempotency-Key' => 'shared-key'])->assertSuccessful();

        $this->assertNull($responseB->headers->get('Idempotent-Replayed'));
        $this->assertSame(1, SalaryAdvanceRequest::where('requester_id', $userA->id)->count());
        $this->assertSame(1, SalaryAdvanceRequest::where('requester_id', $userB->id)->count());
    }

    public function test_stored_responses_are_encrypted_at_rest(): void
    {
        [$http, $user] = $this->asStaff(Tenant::factory()->create());
        $this->payslip($user);
        $http->postJson('/api/v1/finance/advances', $this->advance(['purpose' => 'Encrypted body check']), ['Idempotency-Key' => 'enc-1'])->assertSuccessful();

        $raw = (string) IdempotencyRecord::where('idempotency_key', 'enc-1')->value('response_body');
        $this->assertStringNotContainsString('Encrypted body check', $raw);
        $this->assertStringContainsString('Encrypted body check', \Illuminate\Support\Facades\Crypt::decryptString($raw));
    }

    public function test_credential_and_mfa_endpoints_are_never_recorded(): void
    {
        [$http] = $this->asStaff(Tenant::factory()->create());

        $http->postJson('/api/v1/profile/2fa/enable', [], ['Idempotency-Key' => 'mfa-1'])->assertOk();

        $this->assertSame(0, IdempotencyRecord::where('idempotency_key', 'mfa-1')->count());
    }

    public function test_requests_without_the_header_are_untouched(): void
    {
        [$http, $user] = $this->asStaff(Tenant::factory()->create());
        $this->payslip($user);

        $http->postJson('/api/v1/finance/advances', $this->advance())->assertSuccessful();
        $http->postJson('/api/v1/finance/advances', $this->advance(['purpose' => 'Second']))->assertSuccessful();

        $this->assertSame(0, IdempotencyRecord::count());
        $this->assertSame(2, SalaryAdvanceRequest::where('requester_id', $user->id)->count());
    }
}
