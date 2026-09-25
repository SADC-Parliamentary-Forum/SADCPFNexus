<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\Tenant;
use Tests\TestCase;

/**
 * Optimistic locking on concurrent draft edits (PRD §109).
 *
 * Two officers must not silently overwrite each other: a draft PATCH requires
 * the lock_version last seen, a match increments it, and a stale version is 409.
 */
class ContractOptimisticLockTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
    }

    private function draft(?int $createdBy = null): Contract
    {
        return Contract::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $createdBy ?? $this->makeProcurementOfficer($this->tenant)->id,
            'counterparty_type' => 'organisation',
            'counterparty_name' => 'Lingua CC',
            'title' => 'Interpretation retainer',
            'currency' => 'USD',
            'start_date' => now()->toDateString(),
            'end_date' => now()->addMonth()->toDateString(),
            'value' => 5000,
            'original_value' => 5000,
            'current_value' => 5000,
            'contract_status' => 'DRAFT',
            'status' => 'draft',
        ]);
    }

    public function test_show_includes_lock_version_starting_at_one(): void
    {
        $contract = $this->draft();
        [$po] = $this->asProcurementOfficer($this->tenant);

        $po->getJson("/api/v1/contracts/{$contract->id}")
            ->assertOk()
            ->assertJsonPath('data.lock_version', 1);
    }

    public function test_patch_draft_updates_fields_and_increments_lock_version(): void
    {
        $contract = $this->draft();
        [$po] = $this->asProcurementOfficer($this->tenant);

        $po->patchJson("/api/v1/contracts/{$contract->id}", [
            'lock_version' => 1,
            'title' => 'Revised interpretation retainer',
            'value' => 7500,
        ])->assertOk()
            ->assertJsonPath('data.title', 'Revised interpretation retainer')
            ->assertJsonPath('data.lock_version', 2)
            ->assertJsonPath('data.current_value', '7500.00');

        $this->assertSame(2, (int) $contract->fresh()->lock_version);
        $this->assertSame('Revised interpretation retainer', $contract->fresh()->title);
    }

    public function test_stale_lock_version_returns_409(): void
    {
        $contract = $this->draft();
        [$first] = $this->asProcurementOfficer($this->tenant);
        [$second] = $this->asProcurementOfficer($this->tenant);

        $first->patchJson("/api/v1/contracts/{$contract->id}", [
            'lock_version' => 1,
            'title' => 'First save wins',
        ])->assertOk()->assertJsonPath('data.lock_version', 2);

        $second->patchJson("/api/v1/contracts/{$contract->id}", [
            'lock_version' => 1,
            'title' => 'Stale overwrite',
        ])->assertStatus(409)
            ->assertJsonPath('message', 'Contract was modified by another user. Refresh and retry.');

        $this->assertSame('First save wins', $contract->fresh()->title);
        $this->assertSame(2, (int) $contract->fresh()->lock_version);
    }

    public function test_lock_version_is_required_on_patch(): void
    {
        $contract = $this->draft();
        [$po] = $this->asProcurementOfficer($this->tenant);

        $po->patchJson("/api/v1/contracts/{$contract->id}", [
            'title' => 'Missing version',
        ])->assertStatus(422);
    }

    public function test_cannot_patch_executed_contract(): void
    {
        $contract = $this->draft();
        $contract->update(['contract_status' => 'ACTIVE', 'status' => 'active']);
        [$po] = $this->asProcurementOfficer($this->tenant);

        $po->patchJson("/api/v1/contracts/{$contract->id}", [
            'lock_version' => 1,
            'title' => 'Should not apply',
        ])->assertStatus(422);

        $this->assertSame('Interpretation retainer', $contract->fresh()->title);
    }

    public function test_patch_requires_edit_permission(): void
    {
        $contract = $this->draft();
        [$staff] = $this->asStaff($this->tenant);

        $staff->patchJson("/api/v1/contracts/{$contract->id}", [
            'lock_version' => 1,
            'title' => 'Staff overwrite',
        ])->assertForbidden();
    }

    public function test_deliverable_mutation_bumps_lock_version_so_stale_patch_conflicts(): void
    {
        $contract = $this->draft();
        [$po] = $this->asProcurementOfficer($this->tenant);

        $po->postJson("/api/v1/contracts/{$contract->id}/deliverables", [
            'name' => 'Day 1 interpretation',
        ])->assertCreated();

        $this->assertSame(2, (int) $contract->fresh()->lock_version);

        $po->patchJson("/api/v1/contracts/{$contract->id}", [
            'lock_version' => 1,
            'title' => 'Stale after deliverable',
        ])->assertStatus(409);
    }
}
