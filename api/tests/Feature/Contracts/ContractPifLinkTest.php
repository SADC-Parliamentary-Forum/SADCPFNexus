<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\Programme;
use App\Models\Tenant;
use Tests\TestCase;

/**
 * Bidirectional PIF ↔ contract view (PRD §61).
 *
 * A contract created from a PIF keeps the programme_id; the PIF show payload
 * lists those contracts, and the contract show payload includes the PIF summary
 * so each record can navigate to the other.
 */
class ContractPifLinkTest extends TestCase
{
    private function programme(Tenant $tenant, int $createdBy, array $overrides = []): Programme
    {
        return Programme::create(array_merge([
            'tenant_id' => $tenant->id,
            'created_by' => $createdBy,
            'reference_number' => 'PIF-'.uniqid(),
            'title' => 'Legal Drafters Meeting',
            'status' => 'approved',
            'approved_at' => now(),
            'interpreter_rate' => 450,
        ], $overrides));
    }

    private function contract(Tenant $tenant, int $createdBy, array $overrides = []): Contract
    {
        return Contract::create(array_merge([
            'tenant_id' => $tenant->id,
            'created_by' => $createdBy,
            'counterparty_type' => 'individual',
            'counterparty_name' => 'Stephane Aduya-Ngandu',
            'title' => 'French interpretation',
            'currency' => 'USD',
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(2)->toDateString(),
            'value' => 900,
            'original_value' => 900,
            'current_value' => 900,
            'origin_type' => 'pif',
            'contract_status' => 'DRAFT',
            'status' => 'draft',
        ], $overrides));
    }

    public function test_prefill_from_pif_returns_locked_programme_fields(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $pif = $this->programme($tenant, $officer->id);

        $http->postJson('/api/v1/contracts/prefill', [
            'origin_type' => 'pif',
            'origin_id' => $pif->id,
        ])->assertOk()
            ->assertJsonPath('data.origin_type', 'pif')
            ->assertJsonPath('data.programme_id', $pif->id)
            ->assertJsonPath('data.title', 'Legal Drafters Meeting')
            ->assertJsonPath('data.locked_fields.0', 'programme_id');
    }

    public function test_create_from_pif_persists_programme_link(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $pif = $this->programme($tenant, $officer->id);

        $id = $http->postJson('/api/v1/contracts', [
            'origin_type' => 'pif',
            'programme_id' => $pif->id,
            'counterparty_type' => 'individual',
            'counterparty' => ['first_name' => 'Stephane', 'surname' => 'Aduya-Ngandu'],
            'title' => 'Interpretation from PIF',
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(6)->toDateString(),
            'value' => 1200,
            'currency' => 'USD',
        ])->assertCreated()
            ->assertJsonPath('data.origin_type', 'pif')
            ->assertJsonPath('data.programme_id', $pif->id)
            ->json('data.id');

        $this->assertDatabaseHas('contracts', [
            'id' => $id,
            'programme_id' => $pif->id,
            'origin_type' => 'pif',
        ]);
    }

    public function test_programme_show_lists_linked_contracts(): void
    {
        $tenant = Tenant::factory()->create();
        [$po, $officer] = $this->asProcurementOfficer($tenant);
        $pif = $this->programme($tenant, $officer->id);
        $linked = $this->contract($tenant, $officer->id, [
            'programme_id' => $pif->id,
            'title' => 'Linked interpreter agreement',
        ]);
        $this->contract($tenant, $officer->id, [
            'origin_type' => 'standalone',
            'title' => 'Unrelated standalone',
        ]);

        [$prog] = $this->asProgrammeOfficer($tenant);
        $prog->getJson("/api/v1/programmes/{$pif->id}")
            ->assertOk()
            ->assertJsonPath('contracts.0.id', $linked->id)
            ->assertJsonPath('contracts.0.reference_number', $linked->reference_number)
            ->assertJsonPath('contracts.0.title', 'Linked interpreter agreement')
            ->assertJsonCount(1, 'contracts');
    }

    public function test_contract_show_includes_programme_summary(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $pif = $this->programme($tenant, $officer->id, ['reference_number' => 'PIF-2026-LINK']);
        $contract = $this->contract($tenant, $officer->id, ['programme_id' => $pif->id]);

        $http->getJson("/api/v1/contracts/{$contract->id}")
            ->assertOk()
            ->assertJsonPath('data.programme_id', $pif->id)
            ->assertJsonPath('data.programme.id', $pif->id)
            ->assertJsonPath('data.programme.reference_number', 'PIF-2026-LINK')
            ->assertJsonPath('data.programme.title', 'Legal Drafters Meeting');
    }

    public function test_foreign_tenant_contract_is_not_listed_on_pif(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();
        [$poA, $officerA] = $this->asProcurementOfficer($tenantA);
        $pif = $this->programme($tenantA, $officerA->id);
        $this->contract($tenantA, $officerA->id, [
            'programme_id' => $pif->id,
            'title' => 'Own contract',
        ]);
        $this->contract($tenantB, $this->makeProcurementOfficer($tenantB)->id, [
            'programme_id' => $pif->id,
            'title' => 'Foreign overlay',
            'reference_number' => 'CTR/FOREIGN/9999',
        ]);

        [$prog] = $this->asProgrammeOfficer($tenantA);
        $prog->getJson("/api/v1/programmes/{$pif->id}")
            ->assertOk()
            ->assertJsonCount(1, 'contracts')
            ->assertJsonPath('contracts.0.title', 'Own contract');
    }
}
