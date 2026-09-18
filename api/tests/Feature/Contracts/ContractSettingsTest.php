<?php

namespace Tests\Feature\Contracts;

use App\Models\Currency;
use App\Models\Tenant;
use Database\Seeders\ContractTypeSeeder;
use Database\Seeders\CurrencySeeder;
use Tests\TestCase;

/**
 * Admin: contract type create/update and the central currency module.
 */
class ContractSettingsTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
        $this->seed(CurrencySeeder::class);
        $this->seed(ContractTypeSeeder::class);
    }

    public function test_currency_list_is_readable_and_manageable(): void
    {
        [$po] = $this->asProcurementOfficer($this->tenant);

        $po->getJson('/api/v1/contracts/currencies')->assertOk()->assertJsonFragment(['code' => 'NAD']);

        $po->postJson('/api/v1/contracts/currencies', ['code' => 'kes', 'name' => 'Kenyan Shilling', 'symbol' => 'KSh'])
            ->assertCreated()->assertJsonPath('data.code', 'KES');

        $currency = Currency::where('tenant_id', $this->tenant->id)->where('code', 'KES')->firstOrFail();
        $po->patchJson("/api/v1/contracts/currencies/{$currency->id}", ['is_default' => true])->assertOk()->assertJsonPath('data.is_default', true);

        // Only one default currency.
        $this->assertSame(1, Currency::where('tenant_id', $this->tenant->id)->where('is_default', true)->count());
    }

    public function test_duplicate_currency_code_rejected(): void
    {
        [$po] = $this->asProcurementOfficer($this->tenant);
        $po->postJson('/api/v1/contracts/currencies', ['code' => 'USD', 'name' => 'Dup'])->assertStatus(422);
    }

    public function test_currency_management_requires_permission(): void
    {
        [$staff] = $this->asStaff($this->tenant); // General Employee: no manage perms
        $staff->postJson('/api/v1/contracts/currencies', ['code' => 'XXX', 'name' => 'X'])->assertForbidden();
        // But can read the list.
        $staff->getJson('/api/v1/contracts/currencies')->assertOk();
    }

    public function test_contract_type_create_and_update(): void
    {
        [$po] = $this->asProcurementOfficer($this->tenant);

        $id = $po->postJson('/api/v1/contracts/types', [
            'name' => 'Translation Services Agreement', 'counterparty_type' => 'individual', 'category' => 'services',
        ])->assertCreated()->json('data.id');

        $po->patchJson("/api/v1/contracts/types/{$id}", ['requires_legal_review' => true, 'is_active' => false])
            ->assertOk()
            ->assertJsonPath('data.requires_legal_review', true)
            ->assertJsonPath('data.is_active', false);
    }

    public function test_contract_type_create_requires_management_permission(): void
    {
        [$staff] = $this->asStaff($this->tenant);
        $staff->postJson('/api/v1/contracts/types', ['name' => 'X', 'counterparty_type' => 'individual'])->assertForbidden();
    }
}
