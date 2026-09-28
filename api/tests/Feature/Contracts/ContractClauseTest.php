<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\ContractClause;
use App\Models\ContractClauseAssignment;
use App\Models\Tenant;
use App\Models\Vendor;
use Database\Seeders\ContractClauseSeeder;
use Tests\TestCase;

/**
 * P1 — clause library, versioning, assignment pinning and deviations
 * (PRD §30–§33).
 */
class ContractClauseTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
        $this->seed(ContractClauseSeeder::class);
    }

    private function contract(): Contract
    {
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'Acme', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);

        return Contract::create([
            'tenant_id' => $this->tenant->id, 'created_by' => $this->makeProcurementOfficer($this->tenant)->id,
            'vendor_id' => $vendor->id, 'counterparty_type' => 'organisation', 'title' => 'C',
            'start_date' => now()->addDay()->toDateString(), 'end_date' => now()->addDays(30)->toDateString(),
            'value' => 1000, 'currency' => 'USD', 'contract_status' => 'DRAFT', 'status' => 'draft',
        ]);
    }

    public function test_clause_versioning_pins_to_assignment(): void
    {
        $contract = $this->contract();
        $clause = ContractClause::where('tenant_id', $this->tenant->id)->where('key', 'confidentiality')->firstOrFail();
        $v1 = $clause->current_version_id;

        [$po] = $this->asProcurementOfficer($this->tenant);
        $assignmentId = $po->postJson("/api/v1/contracts/{$contract->id}/clauses", ['clause_id' => $clause->id])
            ->assertCreated()->json('data.id');

        $this->assertSame($v1, ContractClauseAssignment::find($assignmentId)->clause_version_id);

        // Publish + activate a new clause version.
        $v2 = $po->postJson("/api/v1/contracts/clauses/{$clause->id}/versions", ['version' => 'v2.0', 'body' => 'Updated confidentiality terms'])
            ->assertCreated()->json('data.id');
        $po->postJson("/api/v1/contracts/clauses/{$clause->id}/versions/{$v2}/activate")->assertOk();

        // The existing assignment stays pinned to v1.
        $this->assertSame($v1, ContractClauseAssignment::find($assignmentId)->clause_version_id);
    }

    public function test_locked_clause_cannot_be_deviated(): void
    {
        $contract = $this->contract();
        $locked = ContractClause::where('tenant_id', $this->tenant->id)->where('key', 'termination_sadcpf')->firstOrFail();
        [$po] = $this->asProcurementOfficer($this->tenant);

        $po->postJson("/api/v1/contracts/{$contract->id}/clauses", [
            'clause_id' => $locked->id, 'deviation_text' => 'Watered-down termination terms', 'deviation_reason' => 'Supplier request',
        ])->assertStatus(422);
    }

    public function test_editable_clause_deviation_is_recorded(): void
    {
        $contract = $this->contract();
        $clause = ContractClause::where('tenant_id', $this->tenant->id)->where('key', 'confidentiality')->firstOrFail();
        [$po] = $this->asProcurementOfficer($this->tenant);

        $res = $po->postJson("/api/v1/contracts/{$contract->id}/clauses", [
            'clause_id' => $clause->id, 'deviation_text' => 'Confidentiality survives for 5 years post-termination.', 'deviation_reason' => 'Sensitive data',
        ])->assertCreated();

        $res->assertJsonPath('data.is_deviation', true)
            ->assertJsonPath('data.deviation_status', 'pending');
    }

    public function test_mandatory_clause_cannot_be_removed(): void
    {
        $contract = $this->contract();
        $clause = ContractClause::where('tenant_id', $this->tenant->id)->where('key', 'anti_fraud')->firstOrFail();
        [$po] = $this->asProcurementOfficer($this->tenant);

        $assignmentId = $po->postJson("/api/v1/contracts/{$contract->id}/clauses", ['clause_id' => $clause->id])
            ->assertCreated()->json('data.id');

        $po->deleteJson("/api/v1/contracts/{$contract->id}/clauses/{$assignmentId}")->assertStatus(422);
    }

    public function test_library_lists_seeded_clauses(): void
    {
        [$po] = $this->asProcurementOfficer($this->tenant);
        $po->getJson('/api/v1/contracts/clauses')->assertOk()
            ->assertJsonFragment(['key' => 'termination_sadcpf', 'clause_type' => 'mandatory_locked']);
    }

    public function test_clause_library_admin_requires_manage_clause(): void
    {
        $payload = [
            'key' => 'insurance_cover', 'title' => 'Insurance cover', 'clause_type' => 'optional',
            'body' => 'The supplier shall maintain adequate professional indemnity insurance for the term.',
        ];

        $this->assertTrue($this->makeProcurementOfficer($this->tenant)->hasPermissionTo('contract.manage_clause'));

        [$staff] = $this->asStaff($this->tenant);
        $staff->postJson('/api/v1/contracts/clauses', $payload)->assertForbidden();

        $templatesOnly = $this->makeUser('staff', $this->tenant);
        $templatesOnly->givePermissionTo('contract.manage_template');
        $this->asUser($templatesOnly)->postJson('/api/v1/contracts/clauses', $payload)->assertForbidden();

        [$po] = $this->asProcurementOfficer($this->tenant);
        $id = $po->postJson('/api/v1/contracts/clauses', $payload)
            ->assertCreated()->json('data.id');
        $this->assertNotNull(ContractClause::find($id));
    }
}
