<?php

namespace Tests\Feature\Procurement;

use App\Models\ApprovalWorkflow;
use App\Models\DocumentOutput;
use App\Models\NumberingAllocation;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Models\Tenant;
use App\Models\Vendor;
use App\Modules\Documents\Services\DocumentNumberingService;
use App\Modules\Procurement\Services\LpoSequenceAllocator;
use Tests\TestCase;

class PoDocumentEngineTest extends TestCase
{
    private function seedWorkflow(Tenant $tenant, $approver): void
    {
        $workflow = ApprovalWorkflow::create([
            'tenant_id' => $tenant->id,
            'name' => 'LPO Approval Test',
            'module_type' => 'purchase_order',
            'is_active' => true,
        ]);
        $workflow->steps()->create([
            'step_order' => 0,
            'step_name' => 'Finance Certification',
            'approver_type' => 'specific_user',
            'actor_selector' => 'specific_user',
            'user_id' => $approver->id,
            'allow_return' => true,
            'stage_type' => 'certify',
        ]);
    }

    private function awardedPayload(Tenant $tenant): array
    {
        $staff = $this->makeUser('staff', $tenant);
        $req = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'title' => 'IT Equipment',
            'description' => 'Laptops',
            'category' => 'goods',
            'estimated_value' => 10000,
            'currency' => 'NAD',
            'status' => 'awarded',
        ]);
        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'TechSupply Ltd', 'is_approved' => true, 'is_active' => true]);
        $quote = $req->quotes()->create(['vendor_id' => $vendor->id, 'vendor_name' => $vendor->name, 'quoted_amount' => 43000, 'currency' => 'NAD']);
        $req->update(['awarded_quote_id' => $quote->id]);

        return [$req, $vendor];
    }

    public function test_draft_uses_proc_draft_and_submit_allocates_official_number(): void
    {
        $tenant = Tenant::factory()->create();
        $officer = $this->makeProcurementOfficer($tenant);
        $finance = $this->makeFinanceController($tenant);
        $http = $this->asUser($officer);
        $this->seedWorkflow($tenant, $finance);
        app(LpoSequenceAllocator::class)->activate($tenant->id, $officer, 4015, 'Legacy paper register');
        [$req, $vendor] = $this->awardedPayload($tenant);

        $created = $http->postJson('/api/v1/procurement/purchase-orders', [
            'procurement_request_id' => $req->id,
            'vendor_id' => $vendor->id,
            'title' => 'PO for IT',
            'items' => [['description' => 'Laptop', 'quantity' => 1, 'unit' => 'unit', 'unit_price' => 100, 'total_price' => 100]],
        ])->assertCreated();
        $this->assertStringStartsWith('PROC-DRAFT-', $created->json('data.reference_number'));
        $this->assertNull($created->json('data.lpo_number'));
        $id = $created->json('data.id');

        $http->postJson("/api/v1/procurement/purchase-orders/{$id}/issue")
            ->assertUnprocessable();

        $submitted = $http->postJson("/api/v1/procurement/purchase-orders/{$id}/submit")->assertOk();
        $this->assertSame('S 04016', $submitted->json('data.lpo_number'));
        $this->assertSame('S 04016', $submitted->json('data.reference_number'));
        $this->assertSame('S04016', PurchaseOrder::find($id)->normalised_reference);
        $this->assertTrue(NumberingAllocation::query()->where('normalised_reference', 'S04016')->exists());
        $this->assertSame('awaiting_approval', $submitted->json('data.status'));
    }

    public function test_custom_reference_does_not_bump_sequence(): void
    {
        $tenant = Tenant::factory()->create();
        $officer = $this->makeProcurementOfficer($tenant);
        $finance = $this->makeFinanceController($tenant);
        $http = $this->asUser($officer);
        $this->seedWorkflow($tenant, $finance);
        app(LpoSequenceAllocator::class)->activate($tenant->id, $officer, 4015, 'Legacy');
        [$req, $vendor] = $this->awardedPayload($tenant);

        $id = $http->postJson('/api/v1/procurement/purchase-orders', [
            'procurement_request_id' => $req->id,
            'vendor_id' => $vendor->id,
            'title' => 'Donor PO',
            'items' => [['description' => 'Item', 'quantity' => 1, 'unit' => 'unit', 'unit_price' => 10, 'total_price' => 10]],
        ])->json('data.id');

        $http->postJson("/api/v1/procurement/purchase-orders/{$id}/submit", [
            'reference_mode' => 'custom',
            'custom_reference' => 'GIZ/PO/2026/017',
            'custom_reason' => 'Donor-mandated numbering',
        ])->assertOk()->assertJsonPath('data.lpo_number', 'GIZ/PO/2026/017');

        $status = app(DocumentNumberingService::class)->status($tenant->id);
        $this->assertSame('S 04016', $status['next_example']);
    }

    public function test_custom_reference_is_forbidden_without_permission(): void
    {
        $tenant = Tenant::factory()->create();
        $officer = $this->makeProcurementOfficer($tenant);
        $finance = $this->makeFinanceController($tenant);
        $http = $this->asUser($officer);
        $this->seedWorkflow($tenant, $finance);
        app(LpoSequenceAllocator::class)->activate($tenant->id, $officer, 4015, 'Legacy');
        [$req, $vendor] = $this->awardedPayload($tenant);

        $id = $http->postJson('/api/v1/procurement/purchase-orders', [
            'procurement_request_id' => $req->id,
            'vendor_id' => $vendor->id,
            'title' => 'Donor PO',
            'items' => [['description' => 'Item', 'quantity' => 1, 'unit' => 'unit', 'unit_price' => 10, 'total_price' => 10]],
        ])->json('data.id');

        $this->asUser($finance)->postJson("/api/v1/procurement/purchase-orders/{$id}/submit", [
            'reference_mode' => 'custom',
            'custom_reference' => 'GIZ/PO/2026/017',
            'custom_reason' => 'Donor-mandated numbering',
        ])->assertForbidden();
    }

    public function test_duplicate_normalised_custom_reference_is_rejected(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $this->seedWorkflow($tenant, $officer);
        app(LpoSequenceAllocator::class)->activate($tenant->id, $officer, 4015, 'Legacy');
        NumberingAllocation::query()->create([
            'tenant_id' => $tenant->id,
            'document_type' => 'purchase_order',
            'display_reference' => 'S 04015',
            'normalised_reference' => 'S04015',
            'allocation_type' => 'auto',
            'allocated_at' => now(),
        ]);
        [$req, $vendor] = $this->awardedPayload($tenant);
        $id = $http->postJson('/api/v1/procurement/purchase-orders', [
            'procurement_request_id' => $req->id,
            'vendor_id' => $vendor->id,
            'title' => 'Dup',
            'items' => [['description' => 'Item', 'quantity' => 1, 'unit' => 'unit', 'unit_price' => 10, 'total_price' => 10]],
        ])->json('data.id');

        $http->postJson("/api/v1/procurement/purchase-orders/{$id}/submit", [
            'reference_mode' => 'custom',
            'custom_reference' => 'S04015',
            'custom_reason' => 'Retry',
        ])->assertUnprocessable();
    }

    public function test_parse_legacy_and_activate_from_s04015(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asProcurementOfficer($tenant);
        $parsed = $http->postJson('/api/v1/procurement/numbering-profiles/parse', [
            'last_existing_reference' => 'S04015',
        ])->assertOk()->json('data');
        $this->assertSame('S', $parsed['prefix']);
        $this->assertSame(4015, $parsed['sequence']);
        $this->assertSame('S 04016', $parsed['next_example']);

        $http->postJson('/api/v1/procurement/numbering-profiles/activate', [
            'last_existing_reference' => 'S 04015',
            'reason' => 'Migration of historical manual POs',
        ])->assertOk()->assertJsonPath('data.next_example', 'S 04016');
    }

    public function test_template_publish_does_not_change_issued_hash(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $list = $http->getJson('/api/v1/procurement/po-templates')->assertOk();
        $id = $list->json('data.0.id');
        $this->assertNotEmpty($id);
        $http->putJson("/api/v1/procurement/po-templates/{$id}", [
            'layout_json' => [
                'page' => ['size' => 'A4', 'orientation' => 'portrait', 'margin_mm' => ['top' => 12, 'right' => 12, 'bottom' => 12, 'left' => 12]],
                'elements' => [
                    ['type' => 'heading', 'text' => 'VERSION TWO', 'x_mm' => 12, 'y_mm' => 12, 'w_mm' => 80, 'h_mm' => 10],
                ],
            ],
        ])->assertOk();
        $http->postJson("/api/v1/procurement/po-templates/{$id}/publish")->assertOk();

        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'JVJ Plumbing Services', 'is_approved' => true, 'is_active' => true]);
        $po = PurchaseOrder::create([
            'tenant_id' => $tenant->id,
            'vendor_id' => $vendor->id,
            'title' => 'Plumbing',
            'total_amount' => 4499.69,
            'subtotal' => 4499.69,
            'currency' => 'NAD',
            'status' => 'issued',
            'created_by' => $officer->id,
            'lpo_number' => 'S 04016',
            'reference_number' => 'S 04016',
            'normalised_reference' => 'S04016',
            'final_document_hash' => 'abc123frozen',
        ]);
        $output = DocumentOutput::query()->create([
            'tenant_id' => $tenant->id,
            'subject_type' => $po->getMorphClass(),
            'subject_id' => $po->id,
            'document_hash' => 'abc123frozen',
            'verify_token' => 'verifytokenfrozen001',
            'status' => 'issued',
            'generated_at' => now(),
        ]);
        $po->update(['issued_document_output_id' => $output->id]);
        $this->assertSame('abc123frozen', $po->fresh()->final_document_hash);

        $http->putJson("/api/v1/procurement/po-templates/{$id}", [
            'layout_json' => [
                'page' => ['size' => 'A4', 'orientation' => 'portrait', 'margin_mm' => ['top' => 12, 'right' => 12, 'bottom' => 12, 'left' => 12]],
                'elements' => [
                    ['type' => 'heading', 'text' => 'VERSION THREE', 'x_mm' => 12, 'y_mm' => 12, 'w_mm' => 80, 'h_mm' => 10],
                ],
            ],
        ])->assertOk();
        $http->postJson("/api/v1/procurement/po-templates/{$id}/publish")->assertOk();
        $this->assertSame('abc123frozen', PurchaseOrder::find($po->id)->final_document_hash);
        $this->assertSame('abc123frozen', DocumentOutput::find($output->id)->document_hash);
    }

    public function test_public_verify_valid_and_void_without_internal_fields(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'JVJ Plumbing Services', 'is_approved' => true, 'is_active' => true]);
        $po = PurchaseOrder::create([
            'tenant_id' => $tenant->id,
            'vendor_id' => $vendor->id,
            'title' => 'Plumbing',
            'total_amount' => 4499.69,
            'currency' => 'NAD',
            'status' => 'issued',
            'created_by' => $officer->id,
            'lpo_number' => 'S 04016',
            'issued_at' => now(),
        ]);
        DocumentOutput::query()->create([
            'tenant_id' => $tenant->id,
            'subject_type' => $po->getMorphClass(),
            'subject_id' => $po->id,
            'document_hash' => 'hash',
            'verify_token' => 'publictokenvalid001',
            'status' => 'issued',
            'generated_at' => now(),
        ]);
        $valid = $this->getJson('/api/v1/public/purchase-orders/verify/publictokenvalid001')->assertOk()->json('data');
        $this->assertSame('S 04016', $valid['po']);
        $this->assertSame('JVJ Plumbing Services', $valid['supplier']);
        $this->assertSame('VALID', $valid['status']);
        $this->assertArrayNotHasKey('project', $valid);
        $this->assertArrayNotHasKey('budget', $valid);

        $http->postJson("/api/v1/procurement/purchase-orders/{$po->id}/void", ['reason' => 'Raised in error'])->assertOk();
        $voided = $this->getJson('/api/v1/public/purchase-orders/verify/publictokenvalid001')->assertOk()->json('data');
        $this->assertSame('VOID', $voided['status']);
    }

    public function test_pr_json_includes_po_link_when_loaded(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asProcurementOfficer($tenant);
        [$req, $vendor] = $this->awardedPayload($tenant);
        $http->postJson('/api/v1/procurement/purchase-orders', [
            'procurement_request_id' => $req->id,
            'vendor_id' => $vendor->id,
            'title' => 'Linked',
            'items' => [['description' => 'Item', 'quantity' => 1, 'unit' => 'unit', 'unit_price' => 10, 'total_price' => 10]],
        ])->assertCreated();

        $shown = $http->getJson("/api/v1/procurement/requests/{$req->id}")->assertOk();
        $this->assertNotNull($shown->json('po_link') ?? $shown->json('purchase_order'));
    }

    public function test_two_submits_receive_unique_consecutive_numbers(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $this->seedWorkflow($tenant, $officer);
        app(LpoSequenceAllocator::class)->activate($tenant->id, $officer, 4015, 'Legacy');
        [$req, $vendor] = $this->awardedPayload($tenant);

        $first = $http->postJson('/api/v1/procurement/purchase-orders', [
            'procurement_request_id' => $req->id,
            'vendor_id' => $vendor->id,
            'title' => 'First',
            'items' => [['description' => 'Item', 'quantity' => 1, 'unit' => 'unit', 'unit_price' => 10, 'total_price' => 10]],
        ])->json('data.id');
        $http->postJson("/api/v1/procurement/purchase-orders/{$first}/submit")->assertOk()->assertJsonPath('data.lpo_number', 'S 04016');

        $req2 = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $officer->id,
            'title' => 'Second',
            'description' => 'Second',
            'category' => 'goods',
            'estimated_value' => 1000,
            'currency' => 'NAD',
            'status' => 'awarded',
        ]);
        $quote = $req2->quotes()->create(['vendor_id' => $vendor->id, 'vendor_name' => $vendor->name, 'quoted_amount' => 1000, 'currency' => 'NAD']);
        $req2->update(['awarded_quote_id' => $quote->id]);
        $second = $http->postJson('/api/v1/procurement/purchase-orders', [
            'procurement_request_id' => $req2->id,
            'vendor_id' => $vendor->id,
            'title' => 'Second',
            'items' => [['description' => 'Item', 'quantity' => 1, 'unit' => 'unit', 'unit_price' => 10, 'total_price' => 10]],
        ])->json('data.id');
        $http->postJson("/api/v1/procurement/purchase-orders/{$second}/submit")->assertOk()->assertJsonPath('data.lpo_number', 'S 04017');
    }

    public function test_custom_continue_sequence_bumps_when_permitted(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $this->seedWorkflow($tenant, $officer);
        app(LpoSequenceAllocator::class)->activate($tenant->id, $officer, 4015, 'Legacy');
        [$req, $vendor] = $this->awardedPayload($tenant);
        $id = $http->postJson('/api/v1/procurement/purchase-orders', [
            'procurement_request_id' => $req->id,
            'vendor_id' => $vendor->id,
            'title' => 'Continue',
            'items' => [['description' => 'Item', 'quantity' => 1, 'unit' => 'unit', 'unit_price' => 10, 'total_price' => 10]],
        ])->json('data.id');

        $http->postJson("/api/v1/procurement/purchase-orders/{$id}/submit", [
            'reference_mode' => 'custom',
            'custom_reference' => 'S 04020',
            'custom_reason' => 'Align with paper register',
            'continue_sequence' => true,
        ])->assertOk();

        $status = app(DocumentNumberingService::class)->status($tenant->id);
        $this->assertSame('S 04021', $status['next_example']);
    }

    public function test_voided_number_is_never_reused(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $this->seedWorkflow($tenant, $officer);
        app(LpoSequenceAllocator::class)->activate($tenant->id, $officer, 4015, 'Legacy');
        [$req, $vendor] = $this->awardedPayload($tenant);
        $id = $http->postJson('/api/v1/procurement/purchase-orders', [
            'procurement_request_id' => $req->id,
            'vendor_id' => $vendor->id,
            'title' => 'Void me',
            'items' => [['description' => 'Item', 'quantity' => 1, 'unit' => 'unit', 'unit_price' => 10, 'total_price' => 10]],
        ])->json('data.id');
        $http->postJson("/api/v1/procurement/purchase-orders/{$id}/submit")->assertOk();
        $http->postJson("/api/v1/procurement/purchase-orders/{$id}/void", ['reason' => 'Raised in error'])->assertOk();

        $req2 = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $officer->id,
            'title' => 'Replacement',
            'description' => 'Replacement',
            'category' => 'goods',
            'estimated_value' => 1000,
            'currency' => 'NAD',
            'status' => 'awarded',
        ]);
        $quote = $req2->quotes()->create(['vendor_id' => $vendor->id, 'vendor_name' => $vendor->name, 'quoted_amount' => 1000, 'currency' => 'NAD']);
        $req2->update(['awarded_quote_id' => $quote->id]);
        $nextId = $http->postJson('/api/v1/procurement/purchase-orders', [
            'procurement_request_id' => $req2->id,
            'vendor_id' => $vendor->id,
            'title' => 'Replacement',
            'items' => [['description' => 'Item', 'quantity' => 1, 'unit' => 'unit', 'unit_price' => 10, 'total_price' => 10]],
        ])->json('data.id');
        $http->postJson("/api/v1/procurement/purchase-orders/{$nextId}/submit")
            ->assertOk()
            ->assertJsonPath('data.lpo_number', 'S 04017');

        $req3 = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $officer->id,
            'title' => 'Reuse attempt',
            'description' => 'Reuse attempt',
            'category' => 'goods',
            'estimated_value' => 1000,
            'currency' => 'NAD',
            'status' => 'awarded',
        ]);
        $quote3 = $req3->quotes()->create(['vendor_id' => $vendor->id, 'vendor_name' => $vendor->name, 'quoted_amount' => 1000, 'currency' => 'NAD']);
        $req3->update(['awarded_quote_id' => $quote3->id]);
        $reuseId = $http->postJson('/api/v1/procurement/purchase-orders', [
            'procurement_request_id' => $req3->id,
            'vendor_id' => $vendor->id,
            'title' => 'Reuse attempt',
            'items' => [['description' => 'Item', 'quantity' => 1, 'unit' => 'unit', 'unit_price' => 10, 'total_price' => 10]],
        ])->json('data.id');
        $http->postJson("/api/v1/procurement/purchase-orders/{$reuseId}/submit", [
            'reference_mode' => 'custom',
            'custom_reference' => 'S 04016',
            'custom_reason' => 'Reuse voided',
        ])->assertUnprocessable();
    }

    public function test_pending_approval_is_rendered_when_unsigned(): void
    {
        $layout = [
            'page' => ['size' => 'A4', 'orientation' => 'portrait', 'margin_mm' => ['top' => 12, 'right' => 12, 'bottom' => 12, 'left' => 12]],
            'elements' => [
                ['type' => 'approval_block', 'binding' => 'workflow.approvals', 'layout' => 'horizontal', 'x_mm' => 12, 'y_mm' => 200, 'w_mm' => 180, 'h_mm' => 40],
            ],
        ];
        $html = app(\App\Modules\Documents\Services\PurchaseOrderDocumentRenderer::class)->toHtml(
            \App\Modules\Documents\Support\PurchaseOrderLayoutSanitizer::sanitize($layout),
            [
                'po' => ['reference' => 'S 04016'],
                'items' => [],
                'approvals' => [
                    ['label' => 'REQUESTED BY', 'name' => 'Jane', 'pending' => true, 'signature' => null],
                    ['label' => 'FINANCE CERTIFICATION', 'name' => '', 'pending' => true, 'signature' => null],
                ],
            ],
            'design',
        );
        $this->assertStringContainsString('Pending Approval', $html);
        $this->assertStringContainsString('FINANCE CERTIFICATION', $html);
    }

    public function test_template_preview_returns_pdf(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asProcurementOfficer($tenant);
        $id = $http->getJson('/api/v1/procurement/po-templates')->assertOk()->json('data.0.id');
        $pdf = $http->post("/api/v1/procurement/po-templates/{$id}/preview", ['mode' => 'sample']);
        $pdf->assertOk();
        $this->assertStringContainsString('%PDF', $pdf->getContent());
    }
}
