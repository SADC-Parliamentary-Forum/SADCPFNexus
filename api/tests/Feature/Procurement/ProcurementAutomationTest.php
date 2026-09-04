<?php

namespace Tests\Feature\Procurement;

use App\Models\ApprovalWorkflow;
use App\Models\Invoice;
use App\Models\ProcurementException;
use App\Models\ProcurementProject;
use App\Models\PurchaseOrder;
use App\Models\Tenant;
use App\Models\Vendor;
use App\Modules\Procurement\Services\LpoSequenceAllocator;
use Illuminate\Http\UploadedFile;
use Tests\Support\InvoicePdfFixture;
use Tests\TestCase;

class ProcurementAutomationTest extends TestCase
{
    private function pdfFile(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('Invoice_INV0001.pdf', InvoicePdfFixture::inv0001Pdf());
    }

    private function seedVendorAndProject(Tenant $tenant): array
    {
        $vendor = Vendor::create([
            'tenant_id' => $tenant->id,
            'name' => 'JVJ Plumbing Services',
            'contact_phone' => '0814731483',
            'is_approved' => true,
            'is_active' => true,
        ]);
        $project = app(\App\Modules\Procurement\Services\ProcurementProjectService::class)
            ->ensureDefaults($tenant);

        return [$vendor, $project];
    }

    private function activateSequence(Tenant $tenant, $user, int $last = 4015): void
    {
        app(LpoSequenceAllocator::class)->activate($tenant->id, $user, $last, 'Test sequence isolation');
    }

    private function seedLpoWorkflow(Tenant $tenant, $approver): void
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

    public function test_proc_e2e_001_extracts_jvj_invoice(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seedVendorAndProject($tenant);
        [$http] = $this->asProcurementOfficer($tenant);

        $res = $http->post('/api/v1/procurement/intakes', ['file' => $this->pdfFile()], ['Accept' => 'application/json']);
        $res->assertCreated();
        $data = $res->json('data');

        $this->assertSame('invoice', $data['document_type']);
        $this->assertSame('INV0001', $data['document_number']);
        $this->assertSame('2026-05-27', substr((string) $data['document_date'], 0, 10));
        $this->assertCount(5, $data['lines']);
        $this->assertEquals('4499.69', $data['subtotal']);
        $this->assertEquals('4499.69', $data['grand_total']);
        $this->assertFalse((bool) $data['vat_identified']);
        $this->assertSame('VAT not identified — verify', $data['vat_warning']);
        $this->assertNotEmpty($data['vendor_id']);
    }

    public function test_duplicate_invoice_is_blocked(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seedVendorAndProject($tenant);
        [$http] = $this->asProcurementOfficer($tenant);

        $http->post('/api/v1/procurement/intakes', ['file' => $this->pdfFile()])->assertCreated();
        $second = $http->post('/api/v1/procurement/intakes', ['file' => $this->pdfFile()]);
        $second->assertCreated();
        $this->assertSame('duplicate_blocked', $second->json('data.extraction_status'));

        $http->postJson('/api/v1/procurement/intakes/'.$second->json('data.id').'/confirm', [])
            ->assertUnprocessable();
    }

    public function test_staff_cannot_access_intakes(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);
        $http->getJson('/api/v1/procurement/intakes')->assertForbidden();
        $http->post('/api/v1/procurement/intakes', ['file' => $this->pdfFile()])->assertForbidden();
    }

    public function test_lpo_number_and_date_are_not_taken_from_invoice(): void
    {
        $tenant = Tenant::factory()->create();
        [$vendor, $project] = $this->seedVendorAndProject($tenant);
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $this->activateSequence($tenant, $officer, 4015);
        $finance = $this->makeFinanceController($tenant);
        $this->seedLpoWorkflow($tenant, $finance);

        $intakeId = $http->post('/api/v1/procurement/intakes', ['file' => $this->pdfFile()])->json('data.id');
        $http->postJson("/api/v1/procurement/intakes/{$intakeId}/confirm", [
            'procurement_project_id' => $project->id,
            'category' => 'services',
            'exception' => [
                'reason' => 'Service completed before LPO could be raised.',
                'requesting_officer' => 'Facilities',
                'request_date' => '2026-05-20',
                'service_or_goods_date' => '2026-05-27',
                'already_received' => true,
                'emergency' => false,
                'justification' => 'Blocked drain at Forum House.',
                'project' => 'Forum',
            ],
        ])->assertOk();

        $this->assertSame('retrospective', $http->getJson("/api/v1/procurement/intakes/{$intakeId}")->json('data.invoice_first_case'));

        $http->postJson("/api/v1/procurement/intakes/{$intakeId}/create-request", [
            'title' => 'Forum House plumbing',
            'justification' => 'Accessible toilet blockage',
        ])->assertCreated();

        $poId = $http->postJson("/api/v1/procurement/intakes/{$intakeId}/purchase-orders", [])
            ->assertCreated()
            ->json('data.id');

        $draft = PurchaseOrder::find($poId);
        $this->assertStringStartsWith('PROC-DRAFT-', $draft->reference_number);
        $this->assertNull($draft->lpo_number);
        $this->assertTrue((bool) $draft->retrospective);

        $exception = ProcurementException::query()->where('intake_id', $intakeId)->first();
        $this->assertNotNull($exception);
        $http->postJson("/api/v1/procurement/exceptions/{$exception->id}/approve")->assertOk();

        $submitted = $http->postJson("/api/v1/procurement/purchase-orders/{$poId}/submit")->assertOk();
        $this->assertSame('S 04016', $submitted->json('data.lpo_number'));
        $this->assertSame(now()->toDateString(), substr((string) $submitted->json('data.lpo_date'), 0, 10));
        $this->assertNotSame('2026-05-27', substr((string) $submitted->json('data.lpo_date'), 0, 10));
        $this->assertSame($project->id, $submitted->json('data.procurement_project_id') ?? $draft->fresh()->procurement_project_id);
        $this->assertSame($vendor->id, (int) $draft->fresh()->vendor_id);
    }

    public function test_sequence_allocator_issues_25_unique_numbers_via_locked_sequential_allocations(): void
    {
        // lockForUpdate in one PHP process — not 25 OS processes / pcntl_fork.
        $tenant = Tenant::factory()->create();
        $officer = $this->makeProcurementOfficer($tenant);
        $this->activateSequence($tenant, $officer, 0);
        $allocator = app(LpoSequenceAllocator::class);
        $seen = [];
        for ($i = 0; $i < 25; $i++) {
            $seen[] = $allocator->allocate($tenant->id, $officer)['formatted'];
        }
        $this->assertCount(25, array_unique($seen));
        $this->assertSame('S 00001', $seen[0]);
        $this->assertSame('S 00025', $seen[24]);
    }

    public function test_lpo_sequence_is_not_inferred_from_sample_number_4015(): void
    {
        $tenant = Tenant::factory()->create();
        $status = app(LpoSequenceAllocator::class)->status($tenant->id);
        $this->assertNotSame(4015, $status['current_value'] ?? null);
        $this->assertNotSame('S 04016', $status['next_example'] ?? null);
        $this->assertContains($status['status'] ?? '', ['missing', 'pending_activation']);
        try {
            app(LpoSequenceAllocator::class)->allocate($tenant->id);
            $this->fail('Allocate must not issue numbers before live sequence activation.');
        } catch (\Illuminate\Validation\ValidationException $e) {
            $this->assertNotEmpty($e->errors());
        }
    }

    public function test_voided_lpo_number_is_not_reused(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $this->activateSequence($tenant, $officer, 10);
        $first = app(LpoSequenceAllocator::class)->allocate($tenant->id, $officer);
        $this->assertSame('S 00011', $first['formatted']);

        $po = PurchaseOrder::create([
            'tenant_id' => $tenant->id,
            'vendor_id' => Vendor::create(['tenant_id' => $tenant->id, 'name' => 'X', 'is_approved' => true, 'is_active' => true])->id,
            'title' => 'Void me',
            'total_amount' => 1,
            'currency' => 'NAD',
            'status' => 'draft',
            'created_by' => $officer->id,
            'lpo_number' => $first['formatted'],
            'lpo_sequence_number' => $first['sequence'],
        ]);
        $http->postJson("/api/v1/procurement/purchase-orders/{$po->id}/void", ['reason' => 'Raised in error'])->assertOk();
        $next = app(LpoSequenceAllocator::class)->allocate($tenant->id, $officer);
        $this->assertSame('S 00012', $next['formatted']);
        $this->assertNotSame($first['formatted'], $next['formatted']);
    }

    public function test_three_way_match_and_variance_block_finance(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'JVJ Plumbing Services', 'is_approved' => true, 'is_active' => true, 'contact_email' => 'supplier@example.test']);
        $po = PurchaseOrder::create([
            'tenant_id' => $tenant->id,
            'vendor_id' => $vendor->id,
            'title' => 'Plumbing',
            'total_amount' => 4499.69,
            'currency' => 'NAD',
            'status' => 'issued',
            'created_by' => $officer->id,
            'issued_at' => now(),
        ]);
        Invoice::create([
            'tenant_id' => $tenant->id,
            'purchase_order_id' => $po->id,
            'vendor_id' => $vendor->id,
            'vendor_invoice_number' => 'INV0001',
            'invoice_date' => '2026-05-27',
            'amount' => 4499.69,
            'currency' => 'NAD',
            'status' => 'received',
        ]);
        $http->postJson("/api/v1/procurement/purchase-orders/{$po->id}/service-confirmations", [
            'delivered' => 'yes',
            'satisfactory' => true,
            'comments' => 'Drain unblocked.',
        ])->assertCreated();

        $match = $http->postJson("/api/v1/procurement/purchase-orders/{$po->id}/invoice-match")->assertOk();
        $this->assertSame('MATCHED', $match->json('data.status'));
        $http->postJson("/api/v1/procurement/purchase-orders/{$po->id}/finance-handover")->assertOk();

        $po2 = PurchaseOrder::create([
            'tenant_id' => $tenant->id,
            'vendor_id' => $vendor->id,
            'title' => 'Plumbing 2',
            'total_amount' => 4499.69,
            'currency' => 'NAD',
            'status' => 'issued',
            'created_by' => $officer->id,
            'issued_at' => now(),
        ]);
        Invoice::create([
            'tenant_id' => $tenant->id,
            'purchase_order_id' => $po2->id,
            'vendor_id' => $vendor->id,
            'vendor_invoice_number' => 'INV0002',
            'invoice_date' => now()->toDateString(),
            'amount' => 5299.69,
            'currency' => 'NAD',
            'status' => 'received',
        ]);
        $http->postJson("/api/v1/procurement/purchase-orders/{$po2->id}/service-confirmations", [
            'delivered' => 'yes',
            'satisfactory' => true,
        ])->assertCreated();
        $this->assertSame('VARIANCE', $http->postJson("/api/v1/procurement/purchase-orders/{$po2->id}/invoice-match")->json('data.status'));
        $http->postJson("/api/v1/procurement/purchase-orders/{$po2->id}/finance-handover")->assertUnprocessable();
    }

    public function test_pdf_contains_institutional_lpo_fields(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $project = app(\App\Modules\Procurement\Services\ProcurementProjectService::class)->ensureDefaults($tenant);
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
            'lpo_date' => now()->toDateString(),
            'procurement_project_id' => $project->id,
            'vat_identified' => false,
        ]);
        foreach ([
            ['Call out', 1, 350, 350],
            ['Labour', 1, 1300, 1300],
            ['Toilet pot seat cover', 1, 423.80, 423.80],
            ['Toilet pot pen corller', 1, 325.89, 325.89],
            ['Unblocking of the drain', 6, 350, 2100],
        ] as $row) {
            $po->items()->create([
                'description' => $row[0],
                'source_description' => $row[0],
                'quantity' => $row[1],
                'unit_price' => $row[2],
                'total_price' => $row[3],
            ]);
        }

        $html = view('pdf.lpo', [
            'po' => $po->load(['vendor', 'items', 'project', 'createdBy']),
            'letterhead' => ['org_name' => 'SADC Parliamentary Forum', 'org_abbreviation' => 'SADC-PF'],
            'generatedAt' => now(),
        ])->render();
        $this->assertStringContainsString('S 04016', $html);
        $this->assertStringContainsString('Forum', $html);
        $this->assertStringContainsString('JVJ Plumbing', $html);
        $this->assertStringContainsString('4,499.69', $html);
        $this->assertStringContainsString('Call out', $html);
        $this->assertStringContainsString('Labour', $html);
        $this->assertStringContainsString('REQUESTED BY', $html);
        $this->assertStringContainsString('AUTHORISED SIGNATORIES', $html);

        $pdf = $http->get("/api/v1/procurement/purchase-orders/{$po->id}/pdf");
        $pdf->assertOk();
        $this->assertStringContainsString('%PDF', $pdf->getContent());
    }

    public function test_existing_lpo_is_matched_not_duplicated(): void
    {
        $tenant = Tenant::factory()->create();
        [$vendor, $project] = $this->seedVendorAndProject($tenant);
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        PurchaseOrder::create([
            'tenant_id' => $tenant->id,
            'vendor_id' => $vendor->id,
            'title' => 'Existing',
            'total_amount' => 4499.69,
            'currency' => 'NAD',
            'status' => 'issued',
            'created_by' => $officer->id,
            'lpo_number' => 'S 04015',
        ]);
        $intakeId = $http->post('/api/v1/procurement/intakes', ['file' => $this->pdfFile()])->json('data.id');
        $confirm = $http->postJson("/api/v1/procurement/intakes/{$intakeId}/confirm", [
            'procurement_project_id' => $project->id,
        ])->assertOk();
        $this->assertSame('existing_lpo', $confirm->json('data.invoice_first_case'));
        $http->postJson("/api/v1/procurement/intakes/{$intakeId}/purchase-orders")->assertUnprocessable();
    }

    public function test_inbox_imap_stays_unconfigured_even_when_host_env_is_set(): void
    {
        config(['procurement.inbox_imap_host' => 'imap.example.test']);
        $tenant = Tenant::factory()->create();
        [$http] = $this->asProcurementOfficer($tenant);
        $res = $http->getJson('/api/v1/procurement/inbox')->assertOk();
        $this->assertFalse($res->json('imap_configured'));
        $this->assertSame('imap_unconfigured', $res->json('imap_adapter'));
        $this->assertStringContainsString('Upload', (string) $res->json('note'));
    }
}
