<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\ContractClause;
use App\Models\ContractClauseVersion;
use App\Models\ContractDocumentVersion;
use App\Models\Tenant;
use App\Models\Vendor;
use App\Modules\Contracts\Services\ContractDiffService;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * P2 — version comparison / redline diff (PRD §53).
 */
class ContractComparisonTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
        Storage::fake();
    }

    public function test_diff_service_marks_added_and_removed_lines(): void
    {
        $diff = app(ContractDiffService::class)->diff(
            '<p>Clause 1</p><p>Rate USD 8,000</p><p>Delivery 30 September</p>',
            '<p>Clause 1</p><p>Rate USD 8,500</p><p>Delivery 15 October</p>',
        );

        $this->assertSame(2, $diff['added']);
        $this->assertSame(2, $diff['removed']);
        $texts = collect($diff['segments']);
        $this->assertTrue($texts->contains(fn ($s) => $s['type'] === 'unchanged' && $s['text'] === 'Clause 1'));
        $this->assertTrue($texts->contains(fn ($s) => $s['type'] === 'added' && str_contains($s['text'], '8,500')));
        $this->assertTrue($texts->contains(fn ($s) => $s['type'] === 'removed' && str_contains($s['text'], '8,000')));
    }

    public function test_compare_working_document_versions(): void
    {
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'V', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);
        $contract = Contract::create([
            'tenant_id' => $this->tenant->id, 'created_by' => $this->makeProcurementOfficer($this->tenant)->id,
            'vendor_id' => $vendor->id, 'counterparty_type' => 'organisation', 'title' => 'C',
            'start_date' => now()->toDateString(), 'end_date' => now()->addYear()->toDateString(),
            'value' => 1000, 'currency' => 'USD', 'contract_status' => 'DRAFT', 'status' => 'draft',
        ]);

        Storage::put('contracts/x/v1.html', '<p>Remuneration USD 8000</p><p>Term 30 Sep</p>');
        Storage::put('contracts/x/v2.html', '<p>Remuneration USD 8500</p><p>Term 15 Oct</p>');
        $v1 = ContractDocumentVersion::create(['tenant_id' => $this->tenant->id, 'contract_id' => $contract->id, 'version' => 1, 'kind' => 'working', 'storage_path' => 'contracts/x/v1.html', 'hash' => 'a', 'hash_algorithm' => 'sha256']);
        $v2 = ContractDocumentVersion::create(['tenant_id' => $this->tenant->id, 'contract_id' => $contract->id, 'version' => 2, 'kind' => 'working', 'storage_path' => 'contracts/x/v2.html', 'hash' => 'b', 'hash_algorithm' => 'sha256']);

        [$po] = $this->asProcurementOfficer($this->tenant);
        $po->getJson("/api/v1/contracts/{$contract->id}/documents/compare?from={$v1->id}&to={$v2->id}")
            ->assertOk()
            ->assertJsonPath('data.added', 2)
            ->assertJsonPath('data.removed', 2);
    }

    public function test_locked_pdf_versions_cannot_be_text_compared(): void
    {
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'V', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);
        $contract = Contract::create([
            'tenant_id' => $this->tenant->id, 'created_by' => $this->makeProcurementOfficer($this->tenant)->id,
            'vendor_id' => $vendor->id, 'counterparty_type' => 'organisation', 'title' => 'C',
            'start_date' => now()->toDateString(), 'end_date' => now()->addYear()->toDateString(),
            'value' => 1000, 'currency' => 'USD', 'contract_status' => 'DRAFT', 'status' => 'draft',
        ]);
        Storage::put('contracts/x/a.pdf', '%PDF-1');
        Storage::put('contracts/x/b.pdf', '%PDF-2');
        $a = ContractDocumentVersion::create(['tenant_id' => $this->tenant->id, 'contract_id' => $contract->id, 'version' => 1, 'kind' => 'approved', 'storage_path' => 'contracts/x/a.pdf', 'hash' => 'a']);
        $b = ContractDocumentVersion::create(['tenant_id' => $this->tenant->id, 'contract_id' => $contract->id, 'version' => 2, 'kind' => 'approved', 'storage_path' => 'contracts/x/b.pdf', 'hash' => 'b']);

        [$po] = $this->asProcurementOfficer($this->tenant);
        $po->getJson("/api/v1/contracts/{$contract->id}/documents/compare?from={$a->id}&to={$b->id}")
            ->assertStatus(422)->assertJsonValidationErrors('document');
    }

    public function test_compare_clause_versions(): void
    {
        $clause = ContractClause::create(['tenant_id' => $this->tenant->id, 'key' => 'confidentiality', 'title' => 'Confidentiality', 'clause_type' => 'mandatory_editable', 'is_active' => true]);
        $v1 = ContractClauseVersion::create(['tenant_id' => $this->tenant->id, 'clause_id' => $clause->id, 'version' => 'v1.0', 'body' => "Confidential for 2 years.\nNo disclosure.", 'status' => 'SUPERSEDED']);
        $v2 = ContractClauseVersion::create(['tenant_id' => $this->tenant->id, 'clause_id' => $clause->id, 'version' => 'v2.0', 'body' => "Confidential for 5 years.\nNo disclosure.", 'status' => 'ACTIVE']);

        [$po] = $this->asProcurementOfficer($this->tenant);
        $res = $po->getJson("/api/v1/contracts/clauses/{$clause->id}/compare?from={$v1->id}&to={$v2->id}")->assertOk();
        $res->assertJsonPath('data.added', 1)->assertJsonPath('data.removed', 1);
    }
}
