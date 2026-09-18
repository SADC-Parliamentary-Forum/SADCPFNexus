<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\ContractAuthorityDelegation;
use App\Models\ContractAuthorityRule;
use App\Models\ContractTemplateVersion;
use App\Models\ContractType;
use App\Models\Tenant;
use App\Models\Vendor;
use App\Modules\Contracts\Services\ContractAuthorityService;
use Database\Seeders\ContractTemplateSeeder;
use Database\Seeders\ContractTypeSeeder;
use Database\Seeders\WorkflowSeeder;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Contract Authority Matrix (PRD §41) + delegated/acting authority (§42).
 */
class ContractAuthorityTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
    }

    private function contract(float $value = 50000, ?string $currency = 'USD'): Contract
    {
        return Contract::create([
            'tenant_id' => $this->tenant->id, 'created_by' => $this->makeProcurementOfficer($this->tenant)->id,
            'counterparty_type' => 'organisation', 'title' => 'C', 'currency' => $currency,
            'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
            'value' => $value, 'original_value' => $value, 'current_value' => $value,
            'contract_status' => 'IN_REVIEW', 'status' => 'draft',
        ]);
    }

    private function makeRule(array $overrides = []): ContractAuthorityRule
    {
        return ContractAuthorityRule::create(array_merge([
            'tenant_id' => $this->tenant->id, 'name' => 'High value approval', 'action' => 'approve',
            'amount_floor' => 10000, 'authorised_role' => 'Secretary General', 'is_active' => true,
        ], $overrides));
    }

    // ── Admin CRUD + gating ───────────────────────────────────────────────────

    public function test_rule_crud_requires_manage_authority(): void
    {
        [$staff] = $this->asStaff($this->tenant);
        $staff->getJson('/api/v1/contracts/authority/rules')->assertForbidden();

        [$sg] = $this->asSG($this->tenant);
        $id = $sg->postJson('/api/v1/contracts/authority/rules', [
            'name' => 'SG signs high value', 'action' => 'sign', 'amount_floor' => 100000,
            'authorised_role' => 'Secretary General', 'policy_source' => 'Accounting Manual',
        ])->assertCreated()->json('data.id');

        $sg->getJson('/api/v1/contracts/authority/rules')->assertOk()->assertJsonFragment(['id' => $id]);
        $sg->patchJson("/api/v1/contracts/authority/rules/{$id}", ['amount_floor' => 150000])
            ->assertOk()->assertJsonPath('data.amount_floor', '150000.00');
    }

    public function test_delegation_crud_and_revoke(): void
    {
        [$sg] = $this->asSG($this->tenant);
        $delegate = $this->makeFinanceController($this->tenant);

        $id = $sg->postJson('/api/v1/contracts/authority/delegations', [
            'delegator_role' => 'Secretary General', 'delegate_user_id' => $delegate->id, 'action' => 'approve',
            'reason' => 'SG on mission', 'effective_from' => now()->toDateTimeString(), 'expires_at' => now()->addDays(7)->toDateTimeString(),
        ])->assertCreated()->json('data.id');

        $sg->getJson('/api/v1/contracts/authority/delegations')->assertOk()->assertJsonFragment(['id' => $id]);
        $sg->deleteJson("/api/v1/contracts/authority/delegations/{$id}")->assertOk();
        $this->assertFalse(ContractAuthorityDelegation::find($id)->is_active);
    }

    // ── Matrix evaluation (service) ───────────────────────────────────────────

    public function test_rules_match_by_value_band_type_and_effective_date(): void
    {
        $svc = app(ContractAuthorityService::class);

        $this->makeRule(['amount_floor' => 10000, 'amount_ceiling' => 100000]);
        $belowBand = $this->contract(500);
        $inBand = $this->contract(50000);

        $this->assertSame([], $svc->requiredRoles('approve', $belowBand));
        $this->assertContains('Secretary General', $svc->requiredRoles('approve', $inBand));

        // Expired rule does not match.
        ContractAuthorityRule::query()->update(['effective_until' => now()->subDay()->toDateString()]);
        $this->assertSame([], $svc->requiredRoles('approve', $inBand));
    }

    public function test_user_may_act_by_role_or_delegation(): void
    {
        $svc = app(ContractAuthorityService::class);
        $this->makeRule(['amount_floor' => 10000]);
        $contract = $this->contract(50000);

        $sg = $this->makeSG($this->tenant);
        $finance = $this->makeFinanceController($this->tenant);

        $this->assertTrue($svc->userMayAct($sg, 'approve', $contract));
        $this->assertFalse($svc->userMayAct($finance, 'approve', $contract));

        // Delegate SG's approval authority to the finance officer for a live window.
        ContractAuthorityDelegation::create([
            'tenant_id' => $this->tenant->id, 'delegator_role' => 'Secretary General', 'delegate_user_id' => $finance->id,
            'action' => 'approve', 'effective_from' => now()->subHour(), 'expires_at' => now()->addDay(), 'is_active' => true,
        ]);
        $this->assertTrue($svc->userMayAct($finance->fresh(), 'approve', $contract));
    }

    public function test_separation_of_duties_conflict_flagged(): void
    {
        $svc = app(ContractAuthorityService::class);
        $contract = $this->contract(50000);
        $creator = \App\Models\User::find($contract->created_by);

        $this->assertTrue($svc->separationOfDutiesConflict($creator, $contract));
        $this->assertFalse($svc->separationOfDutiesConflict($this->makeSG($this->tenant), $contract));
    }

    // ── Enforcement in the approve endpoint ───────────────────────────────────

    public function test_approve_is_blocked_when_actor_lacks_matrix_authority(): void
    {
        Storage::fake();
        $this->seed(ContractTypeSeeder::class);
        $this->seed(ContractTemplateSeeder::class);
        $this->seed(WorkflowSeeder::class);

        // Require Secretary General for ALL approvals (floor 0).
        $this->makeRule(['amount_floor' => 0]);

        [$po, $officer] = $this->asProcurementOfficer($this->tenant);
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'Lingua', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);
        $type = ContractType::where('tenant_id', $this->tenant->id)->where('name', 'Interpreter Agreement')->firstOrFail();
        $id = $po->postJson('/api/v1/contracts', [
            'type_id' => $type->id, 'counterparty_type' => 'organisation', 'vendor_id' => $vendor->id,
            'title' => 'Gated approval', 'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(12)->toDateString(), 'value' => 900, 'currency' => 'USD',
        ])->assertCreated()->json('data.id');
        $version = ContractTemplateVersion::whereHas('template', fn ($q) => $q->where('tenant_id', $this->tenant->id))->where('status', 'ACTIVE')->first();
        $po->postJson("/api/v1/contracts/{$id}/generate", ['template_version_id' => $version->id])->assertOk();
        $po->postJson("/api/v1/contracts/{$id}/submit")->assertOk();

        // Finance holds contract.approve but not the Secretary General role → blocked by the matrix.
        [$finance] = $this->asFinanceController($this->tenant);
        $finance->postJson("/api/v1/contracts/{$id}/approve", ['comment' => 'x'])
            ->assertForbidden();
    }
}
