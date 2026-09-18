<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\Tenant;
use App\Models\Vendor;
use Database\Seeders\ContractTypeSeeder;
use Tests\TestCase;

/**
 * WS1 — data model: reserved sequential numbering, legacy import, contract types.
 */
class ContractDataModelTest extends TestCase
{
    private function vendor(Tenant $tenant): Vendor
    {
        return Vendor::create([
            'tenant_id' => $tenant->id, 'name' => 'Acme Services',
            'status' => 'approved', 'is_approved' => true, 'is_active' => true,
        ]);
    }

    public function test_contract_numbers_are_sequential_and_reserved_per_tenant_year(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asProcurementOfficer($tenant);
        $vendor = $this->vendor($tenant);
        $year = now()->year;

        $payload = fn () => [
            'vendor_id' => $vendor->id, 'title' => 'Svc', 'value' => 100,
            'start_date' => now()->addDay()->toDateString(), 'end_date' => now()->addDays(5)->toDateString(),
        ];

        $first = $http->postJson('/api/v1/contracts', $payload())->assertCreated()->json('data.reference_number');
        $second = $http->postJson('/api/v1/contracts', $payload())->assertCreated()->json('data.reference_number');

        $this->assertSame(sprintf('CTR/%d/0001', $year), $first);
        $this->assertSame(sprintf('CTR/%d/0002', $year), $second);

        // Cancelling a draft must not free its number (reserved forever).
        $id = Contract::where('reference_number', $second)->value('id');
        $http->deleteJson("/api/v1/contracts/{$id}")->assertOk();
        $third = $http->postJson('/api/v1/contracts', $payload())->assertCreated()->json('data.reference_number');
        $this->assertSame(sprintf('CTR/%d/0003', $year), $third);
    }

    public function test_legacy_import_flags_record_and_allows_individual_without_vendor(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asProcurementOfficer($tenant);

        $res = $http->postJson('/api/v1/contracts/import', [
            'title' => 'Interpreter Agreement — Jean-Pierre Bwebwe',
            'counterparty_name' => 'Jean-Pierre Bwebwe',
            'value' => 450,
            'currency' => 'USD',
            'start_date' => '2026-09-07',
            'end_date' => '2026-09-07',
            'signed_at' => '2026-09-05',
            'legacy_status' => 'completed',
        ])->assertCreated();

        $res->assertJsonPath('data.is_legacy', true)
            ->assertJsonPath('data.origin_type', 'legacy')
            ->assertJsonPath('data.contract_status', 'COMPLETED')
            ->assertJsonPath('data.vendor_id', null)
            ->assertJsonPath('data.counterparty_type', 'individual');
    }

    public function test_legacy_import_requires_a_counterparty(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asProcurementOfficer($tenant);

        $http->postJson('/api/v1/contracts/import', [
            'title' => 'Orphan', 'value' => 1, 'start_date' => '2026-01-01', 'end_date' => '2026-02-01',
        ])->assertStatus(422);
    }

    public function test_contract_types_are_listed(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seed(ContractTypeSeeder::class);
        [$http] = $this->asProcurementOfficer($tenant);

        $http->getJson('/api/v1/contracts/types')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Interpreter Agreement']);
    }
}
