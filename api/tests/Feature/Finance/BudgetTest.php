<?php

namespace Tests\Feature\Finance;

use App\Models\Budget;
use App\Models\Tenant;
use Tests\TestCase;

class BudgetTest extends TestCase
{
    private function budgetPayload(array $overrides = []): array
    {
        return array_merge([
            'year'     => '2026',
            'name'     => 'Q1 2026 Programme Budget',
            'type'     => 'core',
            'currency' => 'NAD',
            'lines'    => [
                [
                    'category'         => 'Travel',
                    'description'      => 'Staff travel costs',
                    'amount_allocated' => 50000.00,
                ],
            ],
        ], $overrides);
    }

    public function test_unauthenticated_cannot_list_budgets(): void
    {
        $this->getJson('/api/v1/finance/budgets')->assertUnauthorized();
    }

    public function test_finance_controller_can_create_budget(): void
    {
        [$http, $user] = $this->asFinanceController();

        $response = $http->postJson('/api/v1/finance/budgets', $this->budgetPayload());

        $response->assertCreated()
                 ->assertJsonPath('data.name', 'Q1 2026 Programme Budget')
                 ->assertJsonPath('data.year', '2026');

        $this->assertDatabaseHas('budgets', [
            'created_by' => $user->id,
        ]);
    }

    public function test_create_budget_requires_year_name_type_and_lines(): void
    {
        [$http] = $this->asFinanceController();

        $http->postJson('/api/v1/finance/budgets', [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['year', 'name', 'type', 'lines']);
    }

    public function test_staff_can_view_budgets(): void
    {
        [$http] = $this->asStaff();

        $response = $http->getJson('/api/v1/finance/budgets');
        $response->assertOk()
                 ->assertJsonStructure(['data']);
    }

    public function test_finance_controller_can_update_budget(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asFinanceController($tenant);

        $create = $http->postJson('/api/v1/finance/budgets', $this->budgetPayload());
        $id = $create->json('data.id');

        $http->putJson("/api/v1/finance/budgets/{$id}", [
            'name' => 'Updated Budget Title',
        ])->assertOk()
           ->assertJsonPath('data.name', 'Updated Budget Title');
    }

    public function test_finance_controller_can_delete_budget(): void
    {
        [$http] = $this->asFinanceController();

        $create = $http->postJson('/api/v1/finance/budgets', $this->budgetPayload());
        $id = $create->json('data.id');

        $http->deleteJson("/api/v1/finance/budgets/{$id}")
             ->assertOk();

        $this->assertDatabaseMissing('budgets', ['id' => $id]);
    }

    public function test_finance_summary_returns_expected_shape(): void
    {
        [$http] = $this->asFinanceController();

        $http->getJson('/api/v1/finance/summary')
             ->assertOk()
             ->assertJsonStructure(['current_net_salary', 'current_gross_salary', 'ytd_gross', 'currency']);
    }

    public function test_any_authenticated_user_can_create_budget(): void
    {
        [$http] = $this->asStaff();

        // Budget creation has no role gate — any authenticated user can create
        $response = $http->postJson('/api/v1/finance/budgets', $this->budgetPayload());
        $response->assertCreated();
    }
}
