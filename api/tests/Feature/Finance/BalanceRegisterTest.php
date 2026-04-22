<?php

namespace Tests\Feature\Finance;

use App\Models\BalanceRegister;
use App\Models\BalanceTransaction;
use App\Models\ImprestRequest;
use App\Models\SalaryAdvanceRequest;
use App\Models\Tenant;
use App\Models\User;
use Tests\TestCase;

class BalanceRegisterTest extends TestCase
{
    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeAdvance(Tenant $tenant, User $user, array $overrides = []): SalaryAdvanceRequest
    {
        return SalaryAdvanceRequest::create(array_merge([
            'tenant_id'        => $tenant->id,
            'requester_id'     => $user->id,
            'reference_number' => 'ADV-' . uniqid(),
            'advance_type'     => 'salary',
            'amount'           => 6000.00,
            'currency'         => 'NAD',
            'repayment_months' => 3,
            'purpose'          => 'Test advance',
            'justification'    => 'Test justification',
            'status'           => 'approved',
        ], $overrides));
    }

    private function makeImprest(Tenant $tenant, User $user, array $overrides = []): ImprestRequest
    {
        return ImprestRequest::create(array_merge([
            'tenant_id'        => $tenant->id,
            'requester_id'     => $user->id,
            'reference_number' => 'IMP-' . uniqid(),
            'purpose'          => 'Conference attendance',
            'amount_requested' => 4000.00,
            'amount_approved'  => 4000.00,
            'currency'         => 'NAD',
            'status'           => 'approved',
        ], $overrides));
    }

    private function makeRegister(Tenant $tenant, User $employee, User $creator, array $overrides = []): BalanceRegister
    {
        $advance = $this->makeAdvance($tenant, $employee);
        return BalanceRegister::create(array_merge([
            'tenant_id'           => $tenant->id,
            'module_type'         => 'salary_advance',
            'employee_id'         => $employee->id,
            'source_request_type' => SalaryAdvanceRequest::class,
            'source_request_id'   => $advance->id,
            'reference_number'    => 'BCR-' . strtoupper(substr(uniqid(), -8)),
            'approved_amount'     => 6000.00,
            'total_processed'     => 0,
            'balance'             => 6000.00,
            'installment_amount'  => 2000.00,
            'status'              => 'active',
            'created_by'          => $creator->id,
        ], $overrides));
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    public function test_unauthenticated_cannot_access_balance_register(): void
    {
        $this->getJson('/api/v1/finance/balance-register')->assertUnauthorized();
        $this->getJson('/api/v1/finance/balance-register/dashboard')->assertUnauthorized();
    }

    // ── Dashboard ─────────────────────────────────────────────────────────────

    public function test_finance_controller_can_view_dashboard(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asFinanceController($tenant);

        $response = $http->getJson('/api/v1/finance/balance-register/dashboard');

        $response->assertOk()
                 ->assertJsonStructure(['data' => [
                     'total_active_registers',
                     'total_outstanding_balance',
                     'pending_verifications',
                     'disputed_registers',
                     'registers_by_module',
                 ]]);
    }

    public function test_staff_can_view_dashboard_with_own_data(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $http->getJson('/api/v1/finance/balance-register/dashboard')->assertOk();
    }

    // ── List / Index ──────────────────────────────────────────────────────────

    public function test_finance_controller_sees_all_tenant_registers(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $controller] = $this->asFinanceController($tenant);
        $employee = $this->makeUser('staff', $tenant);

        $this->makeRegister($tenant, $employee, $controller);
        $this->makeRegister($tenant, $employee, $controller);

        $http->getJson('/api/v1/finance/balance-register')
             ->assertOk()
             ->assertJsonPath('total', 2);
    }

    public function test_staff_can_only_see_own_registers(): void
    {
        $tenant = Tenant::factory()->create();
        $controller = $this->makeFinanceController($tenant);
        [$http, $staff] = $this->asStaff($tenant);
        $otherStaff = $this->makeUser('staff', $tenant);

        $this->makeRegister($tenant, $staff, $controller);
        $this->makeRegister($tenant, $otherStaff, $controller);

        $response = $http->getJson('/api/v1/finance/balance-register');
        $response->assertOk();
        $this->assertEquals(1, $response->json('total'));
    }

    public function test_can_filter_registers_by_module_type(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $controller] = $this->asFinanceController($tenant);
        $employee = $this->makeUser('staff', $tenant);

        $advance  = $this->makeAdvance($tenant, $employee);
        $imprest  = $this->makeImprest($tenant, $employee);

        BalanceRegister::create([
            'tenant_id'           => $tenant->id,
            'module_type'         => 'salary_advance',
            'employee_id'         => $employee->id,
            'source_request_type' => SalaryAdvanceRequest::class,
            'source_request_id'   => $advance->id,
            'reference_number'    => 'BCR-ADV1',
            'approved_amount'     => 3000,
            'total_processed'     => 0,
            'balance'             => 3000,
            'status'              => 'active',
            'created_by'          => $controller->id,
        ]);

        BalanceRegister::create([
            'tenant_id'           => $tenant->id,
            'module_type'         => 'imprest',
            'employee_id'         => $employee->id,
            'source_request_type' => ImprestRequest::class,
            'source_request_id'   => $imprest->id,
            'reference_number'    => 'BCR-IMP1',
            'approved_amount'     => 2000,
            'total_processed'     => 0,
            'balance'             => 2000,
            'status'              => 'active',
            'created_by'          => $controller->id,
        ]);

        $result = $http->getJson('/api/v1/finance/balance-register?module_type=salary_advance');
        $result->assertOk();
        $this->assertEquals(1, $result->json('total'));
    }

    // ── Create Manual Register ────────────────────────────────────────────────

    public function test_finance_controller_can_create_manual_register(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $controller] = $this->asFinanceController($tenant);
        $employee = $this->makeUser('staff', $tenant);
        $advance  = $this->makeAdvance($tenant, $employee);

        $payload = [
            'module_type'        => 'salary_advance',
            'employee_id'        => $employee->id,
            'source_request_id'  => $advance->id,
            'approved_amount'    => 6000.00,
            'installment_amount' => 2000.00,
            'recovery_start_date'=> now()->addMonth()->startOfMonth()->toDateString(),
        ];

        $http->postJson('/api/v1/finance/balance-register', $payload)
             ->assertCreated()
             ->assertJsonPath('data.status', 'active')
             ->assertJsonPath('data.balance', '6000.00');
    }

    public function test_cannot_create_duplicate_register_for_same_source(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $controller] = $this->asFinanceController($tenant);
        $employee = $this->makeUser('staff', $tenant);
        $advance  = $this->makeAdvance($tenant, $employee);

        $payload = [
            'module_type'       => 'salary_advance',
            'employee_id'       => $employee->id,
            'source_request_id' => $advance->id,
            'approved_amount'   => 6000.00,
        ];

        $http->postJson('/api/v1/finance/balance-register', $payload)->assertCreated();
        $http->postJson('/api/v1/finance/balance-register', $payload)->assertUnprocessable();
    }

    public function test_create_register_requires_approved_amount(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asFinanceController($tenant);

        $http->postJson('/api/v1/finance/balance-register', [
            'module_type'       => 'salary_advance',
            'employee_id'       => 1,
            'source_request_id' => 1,
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['approved_amount']);
    }

    public function test_staff_cannot_create_register(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $http->postJson('/api/v1/finance/balance-register', [
            'module_type'       => 'salary_advance',
            'employee_id'       => 1,
            'source_request_id' => 1,
            'approved_amount'   => 5000,
        ])->assertForbidden();
    }

    // ── Show ──────────────────────────────────────────────────────────────────

    public function test_can_view_own_register(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $employee] = $this->asStaff($tenant);
        $controller = $this->makeFinanceController($tenant);
        $register = $this->makeRegister($tenant, $employee, $controller);

        $http->getJson("/api/v1/finance/balance-register/{$register->id}")
             ->assertOk()
             ->assertJsonPath('data.id', $register->id)
             ->assertJsonPath('data.reference_number', $register->reference_number);
    }

    public function test_cannot_view_another_tenants_register(): void
    {
        $tenant1 = Tenant::factory()->create();
        $tenant2 = Tenant::factory()->create();

        [$http] = $this->asFinanceController($tenant1);
        $employee2   = $this->makeUser('staff', $tenant2);
        $controller2 = $this->makeFinanceController($tenant2);
        $register2   = $this->makeRegister($tenant2, $employee2, $controller2);

        $http->getJson("/api/v1/finance/balance-register/{$register2->id}")->assertForbidden();
    }

    // ── Transaction ───────────────────────────────────────────────────────────

    public function test_finance_officer_can_create_recovery_transaction(): void
    {
        $tenant = Tenant::factory()->create();
        $employee = $this->makeUser('staff', $tenant);
        [$http, $controller] = $this->asFinanceController($tenant);
        $register = $this->makeRegister($tenant, $employee, $controller);

        $response = $http->postJson("/api/v1/finance/balance-register/{$register->id}/transactions", [
            'type'   => 'recovery',
            'amount' => 2000.00,
            'notes'  => 'Payroll deduction - month 1',
        ]);

        $response->assertCreated()
                 ->assertJsonPath('data.type', 'recovery')
                 ->assertJsonPath('data.amount', '2000.00')
                 ->assertJsonPath('data.verification_status', 'pending');

        $register->refresh();
        $this->assertEquals('4000.00', $register->balance);
    }

    public function test_transaction_amount_must_be_positive(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $controller] = $this->asFinanceController($tenant);
        $employee = $this->makeUser('staff', $tenant);
        $register = $this->makeRegister($tenant, $employee, $controller);

        $http->postJson("/api/v1/finance/balance-register/{$register->id}/transactions", [
            'type'   => 'recovery',
            'amount' => -100,
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['amount']);
    }

    public function test_cannot_add_transaction_to_locked_register(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $controller] = $this->asFinanceController($tenant);
        $employee = $this->makeUser('staff', $tenant);
        $register = $this->makeRegister($tenant, $employee, $controller);
        $register->update(['status' => 'locked']);

        $http->postJson("/api/v1/finance/balance-register/{$register->id}/transactions", [
            'type'   => 'recovery',
            'amount' => 1000,
        ])->assertStatus(422);
    }

    // ── Verification (Maker-Checker) ──────────────────────────────────────────

    public function test_checker_can_approve_transaction(): void
    {
        $tenant   = Tenant::factory()->create();
        $maker    = $this->makeFinanceController($tenant);
        [$http, $checker] = $this->asFinanceController($tenant);
        $employee = $this->makeUser('staff', $tenant);

        $register = $this->makeRegister($tenant, $employee, $maker);

        $txn = $register->transactions()->create([
            'type'                => 'recovery',
            'amount'              => 2000,
            'previous_balance'    => 6000,
            'new_balance'         => 4000,
            'verification_status' => 'pending',
            'created_by'          => $maker->id,
        ]);

        $http->postJson(
            "/api/v1/finance/balance-register/{$register->id}/transactions/{$txn->id}/verify",
            ['status' => 'approved', 'comments' => 'Verified against payslip']
        )->assertOk()
         ->assertJsonPath('data.status', 'approved');

        $txn->refresh();
        $this->assertEquals('approved', $txn->verification_status);
    }

    public function test_maker_cannot_verify_own_transaction(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $maker] = $this->asFinanceController($tenant);
        $employee = $this->makeUser('staff', $tenant);
        $register = $this->makeRegister($tenant, $employee, $maker);

        $txn = $register->transactions()->create([
            'type'                => 'recovery',
            'amount'              => 2000,
            'previous_balance'    => 6000,
            'new_balance'         => 4000,
            'verification_status' => 'pending',
            'created_by'          => $maker->id,
        ]);

        $http->postJson(
            "/api/v1/finance/balance-register/{$register->id}/transactions/{$txn->id}/verify",
            ['status' => 'approved']
        )->assertStatus(422);
    }

    public function test_rejected_verification_reverses_balance(): void
    {
        $tenant   = Tenant::factory()->create();
        $maker    = $this->makeFinanceController($tenant);
        [$http]   = $this->asFinanceController($tenant);
        $employee = $this->makeUser('staff', $tenant);

        $register = $this->makeRegister($tenant, $employee, $maker, ['balance' => 4000, 'total_processed' => 2000]);

        $txn = $register->transactions()->create([
            'type'                => 'recovery',
            'amount'              => 2000,
            'previous_balance'    => 6000,
            'new_balance'         => 4000,
            'verification_status' => 'pending',
            'created_by'          => $maker->id,
        ]);

        $http->postJson(
            "/api/v1/finance/balance-register/{$register->id}/transactions/{$txn->id}/verify",
            ['status' => 'rejected', 'comments' => 'Amount does not match payslip']
        )->assertOk();

        $register->refresh();
        $this->assertEquals('6000.00', $register->balance);
    }

    // ── Lock / Unlock ─────────────────────────────────────────────────────────

    public function test_finance_controller_can_lock_register_with_no_pending(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $controller] = $this->asFinanceController($tenant);
        $employee = $this->makeUser('staff', $tenant);
        $register = $this->makeRegister($tenant, $employee, $controller);

        $http->postJson("/api/v1/finance/balance-register/{$register->id}/lock")
             ->assertOk()
             ->assertJsonPath('data.status', 'locked');
    }

    public function test_cannot_lock_register_with_pending_transactions(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $controller] = $this->asFinanceController($tenant);
        $employee = $this->makeUser('staff', $tenant);
        $register = $this->makeRegister($tenant, $employee, $controller);

        $register->transactions()->create([
            'type'                => 'recovery',
            'amount'              => 1000,
            'previous_balance'    => 6000,
            'new_balance'         => 5000,
            'verification_status' => 'pending',
            'created_by'          => $controller->id,
        ]);

        $http->postJson("/api/v1/finance/balance-register/{$register->id}/lock")
             ->assertUnprocessable();
    }

    public function test_staff_cannot_lock_register(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);
        $controller = $this->makeFinanceController($tenant);
        $employee = $this->makeUser('staff', $tenant);
        $register = $this->makeRegister($tenant, $employee, $controller);

        $http->postJson("/api/v1/finance/balance-register/{$register->id}/lock")->assertForbidden();
    }

    public function test_finance_controller_can_unlock_register(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $controller] = $this->asFinanceController($tenant);
        $employee = $this->makeUser('staff', $tenant);
        $register = $this->makeRegister($tenant, $employee, $controller, ['status' => 'locked']);

        $http->postJson("/api/v1/finance/balance-register/{$register->id}/unlock")
             ->assertOk()
             ->assertJsonPath('data.status', 'active');
    }

    // ── Acknowledge ───────────────────────────────────────────────────────────

    public function test_employee_can_confirm_own_balance(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $employee] = $this->asStaff($tenant);
        $controller = $this->makeFinanceController($tenant);
        $register = $this->makeRegister($tenant, $employee, $controller);

        $http->postJson("/api/v1/finance/balance-register/{$register->id}/acknowledge", [
            'status' => 'confirmed',
        ])->assertOk()
          ->assertJsonPath('data.status', 'confirmed');
    }

    public function test_employee_can_dispute_balance_with_reason(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $employee] = $this->asStaff($tenant);
        $controller = $this->makeFinanceController($tenant);
        $register = $this->makeRegister($tenant, $employee, $controller);

        $http->postJson("/api/v1/finance/balance-register/{$register->id}/acknowledge", [
            'status'         => 'disputed',
            'dispute_reason' => 'Amount does not match my payslip for March.',
        ])->assertOk()
          ->assertJsonPath('data.status', 'disputed');

        $register->refresh();
        $this->assertEquals('disputed', $register->status);
    }

    public function test_dispute_requires_reason(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $employee] = $this->asStaff($tenant);
        $controller = $this->makeFinanceController($tenant);
        $register = $this->makeRegister($tenant, $employee, $controller);

        $http->postJson("/api/v1/finance/balance-register/{$register->id}/acknowledge", [
            'status' => 'disputed',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['dispute_reason']);
    }

    public function test_employee_cannot_acknowledge_another_employees_register(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);
        $controller  = $this->makeFinanceController($tenant);
        $otherStaff  = $this->makeUser('staff', $tenant);
        $register    = $this->makeRegister($tenant, $otherStaff, $controller);

        $http->postJson("/api/v1/finance/balance-register/{$register->id}/acknowledge", [
            'status' => 'confirmed',
        ])->assertForbidden();
    }

    // ── Exceptions ────────────────────────────────────────────────────────────

    public function test_finance_controller_can_view_exceptions(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asFinanceController($tenant);

        $http->getJson('/api/v1/finance/balance-register/exceptions')
             ->assertOk();
    }

    public function test_disputed_register_appears_in_exceptions(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $controller] = $this->asFinanceController($tenant);
        $employee = $this->makeUser('staff', $tenant);
        $this->makeRegister($tenant, $employee, $controller, ['status' => 'disputed']);

        $response = $http->getJson('/api/v1/finance/balance-register/exceptions');
        $response->assertOk();
        $this->assertGreaterThanOrEqual(1, $response->json('total'));
    }

    // ── Cross-tenant isolation ────────────────────────────────────────────────

    public function test_register_cannot_be_modified_by_different_tenant(): void
    {
        $tenant1 = Tenant::factory()->create();
        $tenant2 = Tenant::factory()->create();

        [$http1]    = $this->asFinanceController($tenant1);
        $controller2 = $this->makeFinanceController($tenant2);
        $employee2   = $this->makeUser('staff', $tenant2);
        $register2   = $this->makeRegister($tenant2, $employee2, $controller2);

        $http1->postJson("/api/v1/finance/balance-register/{$register2->id}/lock")
              ->assertForbidden();
    }
}
