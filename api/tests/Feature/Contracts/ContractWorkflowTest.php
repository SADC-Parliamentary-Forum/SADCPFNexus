<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\ContractTemplateVersion;
use App\Models\ContractType;
use App\Models\Tenant;
use App\Models\Vendor;
use Database\Seeders\ContractTemplateSeeder;
use Database\Seeders\ContractTypeSeeder;
use Database\Seeders\WorkflowSeeder;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * WS3 — approval workflow: sequential Finance -> SG chain, separation of duties,
 * return-for-correction, and readiness-gated submission.
 */
class ContractWorkflowTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
        Storage::fake();
        $this->seed(ContractTypeSeeder::class);
        $this->seed(ContractTemplateSeeder::class);
        $this->seed(WorkflowSeeder::class);
    }

    private function readyContract(): array
    {
        [$http, $officer] = $this->asProcurementOfficer($this->tenant);
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'Lingua CC', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);
        $type = ContractType::where('tenant_id', $this->tenant->id)->where('name', 'Interpreter Agreement')->firstOrFail();

        $id = $http->postJson('/api/v1/contracts', [
            'type_id' => $type->id, 'counterparty_type' => 'organisation', 'vendor_id' => $vendor->id,
            'title' => 'Interpretation — Small Engagement', 'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(12)->toDateString(), 'value' => 900, 'currency' => 'USD',
        ])->assertCreated()->json('data.id');

        $version = ContractTemplateVersion::whereHas('template', fn ($q) => $q->where('tenant_id', $this->tenant->id))
            ->where('status', 'ACTIVE')->first();
        $http->postJson("/api/v1/contracts/{$id}/generate", ['template_version_id' => $version->id])->assertOk();

        return [$http, $officer, $id];
    }

    public function test_submission_is_blocked_until_document_is_ready(): void
    {
        [$http, $officer] = $this->asProcurementOfficer($this->tenant);
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'V', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);
        $type = ContractType::where('tenant_id', $this->tenant->id)->where('name', 'Interpreter Agreement')->firstOrFail();

        $id = $http->postJson('/api/v1/contracts', [
            'type_id' => $type->id, 'counterparty_type' => 'organisation', 'vendor_id' => $vendor->id,
            'title' => 'No Doc Yet', 'start_date' => now()->addDay()->toDateString(),
            'end_date' => now()->addDays(3)->toDateString(), 'value' => 900, 'currency' => 'USD',
        ])->assertCreated()->json('data.id');

        // No working draft generated → readiness blocks submission.
        $http->postJson("/api/v1/contracts/{$id}/submit")->assertStatus(422)->assertJsonValidationErrors('readiness');
    }

    public function test_full_finance_then_sg_approval_chain(): void
    {
        [$http, $officer, $id] = $this->readyContract();

        $http->postJson("/api/v1/contracts/{$id}/submit")->assertOk()
            ->assertJsonPath('data.contract_status', 'IN_REVIEW');

        // Separation of duties: the preparing Procurement Officer cannot approve.
        $http->postJson("/api/v1/contracts/{$id}/approve")->assertForbidden();

        // Finance certifies (step 0). Legal + Director steps skip (no legal review, value < 10k).
        [$finance] = $this->asFinanceController($this->tenant);
        $finance->postJson("/api/v1/contracts/{$id}/approve", ['comment' => 'Budget confirmed'])->assertOk();

        // Secretary General approves (final).
        [$sg] = $this->asSG($this->tenant);
        $sg->postJson("/api/v1/contracts/{$id}/approve", ['comment' => 'Approved for signature'])->assertOk();

        $this->assertSame('APPROVED_FOR_SIGNATURE', Contract::find($id)->contract_status);
    }

    public function test_finance_can_return_for_correction(): void
    {
        [$http, $officer, $id] = $this->readyContract();
        $http->postJson("/api/v1/contracts/{$id}/submit")->assertOk();

        [$finance] = $this->asFinanceController($this->tenant);
        $finance->postJson("/api/v1/contracts/{$id}/return", ['comment' => 'Please attach the TOR'])->assertOk();

        $this->assertSame('CHANGES_REQUESTED', Contract::find($id)->contract_status);
    }
}
