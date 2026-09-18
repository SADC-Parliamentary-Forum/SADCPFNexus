<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\ContractDocumentVersion;
use App\Models\ContractSignatory;
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
 * WS4 — execution & signature: approved PDF + hashing, internal + external
 * signing, executed immutability, hash-integrity, decline, and activation.
 * Covers release-blocking acceptance tests §119, §120, §121, §125.
 */
class ContractSignatureTest extends TestCase
{
    private Tenant $tenant;

    private \App\Models\User $po;

    private \App\Models\User $finance;

    private \App\Models\User $sg;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
        Storage::fake();
        $this->seed(ContractTypeSeeder::class);
        $this->seed(ContractTemplateSeeder::class);
        $this->seed(WorkflowSeeder::class);

        $this->po = $this->makeProcurementOfficer($this->tenant);
        $this->finance = $this->makeFinanceController($this->tenant);
        $this->sg = $this->makeSG($this->tenant);
    }

    /** Create -> generate -> submit -> Finance -> SG approve => APPROVED_FOR_SIGNATURE. */
    private function approvedContract(array $overrides = []): int
    {
        $this->asUser($this->po);
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'Lingua CC', 'contact_email' => 'ext@example.test', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);
        $type = ContractType::where('tenant_id', $this->tenant->id)->where('name', 'Interpreter Agreement')->firstOrFail();

        $id = $this->postJson('/api/v1/contracts', array_merge([
            'type_id' => $type->id, 'counterparty_type' => 'organisation', 'vendor_id' => $vendor->id,
            'title' => 'Interpretation Retainer', 'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(20)->toDateString(), 'value' => 900, 'currency' => 'USD',
        ], $overrides))->assertCreated()->json('data.id');

        $version = ContractTemplateVersion::whereHas('template', fn ($q) => $q->where('tenant_id', $this->tenant->id))
            ->where('status', 'ACTIVE')->first();
        $this->postJson("/api/v1/contracts/{$id}/generate", ['template_version_id' => $version->id])->assertOk();
        $this->postJson("/api/v1/contracts/{$id}/submit")->assertOk();

        $this->asUser($this->finance)->postJson("/api/v1/contracts/{$id}/approve", ['comment' => 'ok'])->assertOk();
        $this->asUser($this->sg)->postJson("/api/v1/contracts/{$id}/approve", ['comment' => 'ok'])->assertOk();

        $this->assertSame('APPROVED_FOR_SIGNATURE', Contract::find($id)->contract_status);

        return $id;
    }

    public function test_full_execution_flow_internal_then_external(): void
    {
        $id = $this->approvedContract();

        $this->asUser($this->po)->postJson("/api/v1/contracts/{$id}/send-for-signature")->assertOk()
            ->assertJsonPath('data.contract_status', 'SENT_FOR_SIGNATURE');

        // Approved document is locked and hashed.
        $approved = ContractDocumentVersion::where('contract_id', $id)->where('kind', 'approved')->first();
        $this->assertNotNull($approved);
        $this->assertTrue($approved->is_locked);
        $this->assertNotEmpty($approved->hash);

        // SADC PF signs first.
        $this->asUser($this->sg)->postJson("/api/v1/contracts/{$id}/sign")->assertOk()
            ->assertJsonPath('data.contract_status', 'PARTIALLY_SIGNED');

        // Counterparty signs via the secure external link (no account).
        $token = ContractSignatory::where('contract_id', $id)->where('party', 'counterparty')->value('token');
        $this->assertNotEmpty($token);
        $this->postJson("/api/v1/external/contracts/sign/{$token}", ['name' => 'Stephane Aduya-Ngandu', 'consent' => true])
            ->assertOk();

        $contract = Contract::find($id);
        $this->assertSame('FULLY_EXECUTED', $contract->contract_status);
        $this->assertSame('signed', $contract->signature_status);
        $this->assertDatabaseHas('contract_document_versions', ['contract_id' => $id, 'kind' => 'executed', 'is_locked' => true]);

        // Activation only after full execution.
        $this->asUser($this->sg)->postJson("/api/v1/contracts/{$id}/activate")->assertOk()->assertJsonPath('data.contract_status', 'ACTIVE');
    }

    public function test_hash_mismatch_blocks_signature(): void
    {
        // AT §120 — a document that differs from the approved version cannot be signed.
        $id = $this->approvedContract();
        $this->asUser($this->po)->postJson("/api/v1/contracts/{$id}/send-for-signature")->assertOk();

        $approved = ContractDocumentVersion::where('contract_id', $id)->where('kind', 'approved')->first();
        Storage::put($approved->storage_path, 'TAMPERED CONTENT');

        $this->asUser($this->sg)->postJson("/api/v1/contracts/{$id}/sign")->assertStatus(422)->assertJsonValidationErrors('document');
    }

    public function test_signed_contract_document_cannot_be_regenerated(): void
    {
        // AT §119 — after signing, the document is immutable (create amendment instead).
        $id = $this->approvedContract();
        $this->asUser($this->po)->postJson("/api/v1/contracts/{$id}/send-for-signature")->assertOk();
        $this->asUser($this->sg)->postJson("/api/v1/contracts/{$id}/sign")->assertOk();

        $version = ContractTemplateVersion::whereHas('template', fn ($q) => $q->where('tenant_id', $this->tenant->id))
            ->where('status', 'ACTIVE')->first();
        $this->asUser($this->po)->postJson("/api/v1/contracts/{$id}/generate", ['template_version_id' => $version->id])
            ->assertStatus(422)->assertJsonValidationErrors('document');
    }

    public function test_external_counterparty_can_decline(): void
    {
        // AT §125 — external decline captures a reason and marks the contract Declined.
        $id = $this->approvedContract();
        $this->asUser($this->po)->postJson("/api/v1/contracts/{$id}/send-for-signature")->assertOk();

        $token = ContractSignatory::where('contract_id', $id)->where('party', 'counterparty')->value('token');
        $this->postJson("/api/v1/external/contracts/decline/{$token}", ['reason' => 'Rate not agreed'])->assertOk();

        $this->assertSame('DECLINED', Contract::find($id)->contract_status);
    }

    public function test_activate_requires_full_execution(): void
    {
        $id = $this->approvedContract();
        $this->asUser($this->sg)->postJson("/api/v1/contracts/{$id}/activate")->assertStatus(422)->assertJsonValidationErrors('status');
    }

    public function test_start_before_execution_raises_critical_exception(): void
    {
        // AT §121 — service start reached while unexecuted => critical exception on view.
        $this->asUser($this->po);
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'V', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);
        $type = ContractType::where('tenant_id', $this->tenant->id)->where('name', 'Interpreter Agreement')->firstOrFail();

        $id = $this->postJson('/api/v1/contracts', [
            'type_id' => $type->id, 'counterparty_type' => 'organisation', 'vendor_id' => $vendor->id,
            'title' => 'Retrospective', 'start_date' => now()->subDays(2)->toDateString(),
            'end_date' => now()->addDays(5)->toDateString(), 'value' => 900, 'currency' => 'USD',
        ])->assertCreated()->json('data.id');

        $res = $this->getJson("/api/v1/contracts/{$id}")->assertOk();
        $exceptions = collect($res->json('data.exceptions'));
        $this->assertTrue($exceptions->contains(fn ($e) => $e['type'] === 'service_started_before_execution' && $e['severity'] === 'critical'));
    }
}
