<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\ContractType;
use App\Models\Tenant;
use App\Models\Vendor;
use Database\Seeders\ContractTypeSeeder;
use Tests\TestCase;

/**
 * Multi-currency budget tracking (PRD §21): contract currency, budget currency,
 * conversion reference and converted commitment are stored separately and the
 * original contract value is never overwritten by budget data.
 */
class ContractMultiCurrencyTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
        $this->seed(ContractTypeSeeder::class);
    }

    public function test_budget_currency_fields_persist_separately_from_contract_value(): void
    {
        [$po] = $this->asProcurementOfficer($this->tenant);
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'V', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);
        $type = ContractType::where('tenant_id', $this->tenant->id)->first();

        $id = $po->postJson('/api/v1/contracts', [
            'type_id' => $type->id, 'counterparty_type' => 'organisation', 'vendor_id' => $vendor->id,
            'title' => 'USD contract, N$ budget', 'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
            'value' => 900, 'currency' => 'USD',
            'budget_currency' => 'NAD', 'conversion_reference' => 'BON avg Sep 2026 @ 18.5', 'converted_value' => 16650,
        ])->assertCreated()->json('data.id');

        $contract = Contract::find($id);
        $this->assertSame('USD', $contract->currency);
        $this->assertSame('NAD', $contract->budget_currency);
        $this->assertSame('BON avg Sep 2026 @ 18.5', $contract->conversion_reference);
        $this->assertEqualsWithDelta(16650, (float) $contract->converted_value, 0.01);
        // Contract value stays in contract currency, untouched by budget data.
        $this->assertEqualsWithDelta(900, (float) $contract->current_value, 0.01);
        $this->assertEqualsWithDelta(900, (float) $contract->original_value, 0.01);

        $po->getJson("/api/v1/contracts/{$id}")->assertOk()
            ->assertJsonPath('data.budget_currency', 'NAD')
            ->assertJsonPath('data.converted_value', fn ($v) => abs((float) $v - 16650) < 0.01);
    }
}
