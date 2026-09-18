<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\ContractDeliverable;
use App\Models\ContractDocumentVersion;
use App\Models\ContractObligation;
use App\Models\ContractSignatory;
use App\Models\Tenant;
use App\Models\Vendor;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * P2 — external counterparty workspace (PRD §95): scoped, read-only access to
 * one contract only, with no internal data leakage.
 */
class ContractExternalWorkspaceTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
        Storage::fake();
    }

    private function contractWithToken(?string $docPath = null): array
    {
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'Lingua', 'contact_email' => 'p@example.test', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);
        $contract = Contract::create([
            'tenant_id' => $this->tenant->id, 'created_by' => $this->makeProcurementOfficer($this->tenant)->id,
            'vendor_id' => $vendor->id, 'counterparty_type' => 'organisation', 'counterparty_name' => 'Lingua',
            'title' => 'Interpretation', 'start_date' => now()->addWeek()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
            'value' => 900, 'current_value' => 900, 'currency' => 'USD', 'budget_line' => 'OP-01', 'department_id' => null,
            'scope' => ['purpose' => 'Interpretation for the legal drafters meeting', 'location' => 'Windhoek'],
            'contract_status' => 'SENT_FOR_SIGNATURE', 'status' => 'draft', 'signature_status' => 'awaiting',
        ]);
        ContractDeliverable::create(['tenant_id' => $this->tenant->id, 'contract_id' => $contract->id, 'number' => 1, 'name' => 'Interpretation Day 1', 'status' => 'not_started', 'responsible_party' => 'counterparty', 'internal_reviewer_id' => 999, 'due_date' => now()->addWeek()->toDateString()]);
        ContractObligation::create(['tenant_id' => $this->tenant->id, 'contract_id' => $contract->id, 'obligation' => 'Maintain confidentiality', 'responsible_party' => 'counterparty', 'status' => 'open']);

        if ($docPath) {
            Storage::put($docPath, '<p>Contract body</p>');
            $doc = ContractDocumentVersion::create(['tenant_id' => $this->tenant->id, 'contract_id' => $contract->id, 'version' => 1, 'kind' => 'working', 'storage_path' => $docPath, 'hash' => 'abc', 'hash_algorithm' => 'sha256']);
            $contract->update(['current_document_version_id' => $doc->id]);
        }

        $token = Str::random(48);
        ContractSignatory::create([
            'tenant_id' => $this->tenant->id, 'contract_id' => $contract->id, 'party' => 'counterparty', 'sign_order' => 2,
            'method' => 'electronic', 'status' => 'pending', 'signer_name' => 'Jane', 'signer_email' => 'p@example.test',
            'token' => $token, 'token_expires_at' => now()->addDays(14),
        ]);
        ContractSignatory::create([
            'tenant_id' => $this->tenant->id, 'contract_id' => $contract->id, 'party' => 'sadcpf', 'sign_order' => 1,
            'method' => 'electronic', 'status' => 'signed', 'signed_at' => now(),
        ]);

        return [$contract, $token];
    }

    public function test_workspace_returns_scoped_data_without_internal_fields(): void
    {
        [, $token] = $this->contractWithToken();

        $res = $this->getJson("/api/v1/external/contracts/sign/{$token}")->assertOk();

        $res->assertJsonPath('data.reference_number', fn ($v) => is_string($v))
            ->assertJsonPath('data.purpose', 'Interpretation for the legal drafters meeting')
            ->assertJsonCount(1, 'data.deliverables')
            ->assertJsonCount(1, 'data.obligations')
            ->assertJsonCount(2, 'data.signatories');

        // No internal leakage.
        $res->assertJsonMissingPath('data.budget_line')
            ->assertJsonMissingPath('data.department_id')
            ->assertJsonMissingPath('data.created_by')
            ->assertJsonMissingPath('data.tenant_id')
            ->assertJsonMissingPath('data.approval_request');
        // Deliverable internal reviewer must not be exposed.
        $this->assertStringNotContainsString('internal_reviewer', $res->getContent());
    }

    public function test_document_download_when_available(): void
    {
        [, $token] = $this->contractWithToken('contracts/ext/v1.html');
        $this->get("/api/v1/external/contracts/sign/{$token}/document")->assertOk();
    }

    public function test_document_404_when_none(): void
    {
        [, $token] = $this->contractWithToken();
        $this->get("/api/v1/external/contracts/sign/{$token}/document")->assertNotFound();
    }

    public function test_invalid_and_expired_tokens(): void
    {
        $this->getJson('/api/v1/external/contracts/sign/nope')->assertNotFound();

        [, $token] = $this->contractWithToken();
        ContractSignatory::where('token', $token)->update(['token_expires_at' => now()->subDay()]);
        $this->getJson("/api/v1/external/contracts/sign/{$token}")->assertStatus(410);
    }
}
