<?php

namespace Tests\Feature\Procurement;

use App\Models\Invoice;
use App\Models\ProcurementQuote;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Models\RfqInvitation;
use App\Models\SupplierChangeRequest;
use App\Models\SupplierDocument;
use App\Models\Tenant;
use App\Models\Vendor;
use App\Modules\Procurement\Services\SupplierCatalogueSeeder;
use App\Modules\Procurement\Support\BankAccountMasker;
use Tests\TestCase;

class SupplierIsolationTest extends TestCase
{
    public function test_supplier_cannot_read_another_suppliers_documents_quotes_pos_or_invoices(): void
    {
        $tenant = Tenant::factory()->create();
        [, $userA] = $this->asSupplier($tenant);
        [, $userB] = $this->asSupplier($tenant);
        $vendorB = Vendor::find($userB->vendor_id);

        $officer = $this->makeProcurementOfficer($tenant);
        $rfq = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $officer->id,
            'title' => 'Secret RFQ',
            'description' => 'Internal',
            'category' => 'goods',
            'estimated_value' => 50000,
            'currency' => 'NAD',
            'status' => 'approved',
            'rfq_issued_at' => now(),
        ]);
        $inviteB = RfqInvitation::create([
            'tenant_id' => $tenant->id,
            'procurement_request_id' => $rfq->id,
            'vendor_id' => $vendorB->id,
            'status' => 'pending',
            'invited_at' => now(),
        ]);
        ProcurementQuote::create([
            'procurement_request_id' => $rfq->id,
            'rfq_invitation_id' => $inviteB->id,
            'vendor_id' => $vendorB->id,
            'vendor_name' => $vendorB->name,
            'quoted_amount' => 12345,
            'currency' => 'NAD',
        ]);
        $po = PurchaseOrder::create([
            'tenant_id' => $tenant->id,
            'vendor_id' => $vendorB->id,
            'procurement_request_id' => $rfq->id,
            'title' => 'PO B',
            'status' => 'issued',
            'total_amount' => 10,
            'currency' => 'NAD',
            'created_by' => $officer->id,
        ]);
        Invoice::create([
            'tenant_id' => $tenant->id,
            'vendor_id' => $vendorB->id,
            'purchase_order_id' => $po->id,
            'vendor_invoice_number' => 'INV-B',
            'invoice_date' => now()->toDateString(),
            'due_date' => now()->addDays(14)->toDateString(),
            'status' => 'draft',
            'amount' => 10,
            'currency' => 'NAD',
        ]);

        $doc = SupplierDocument::create([
            'tenant_id' => $tenant->id,
            'vendor_id' => $vendorB->id,
            'type_code' => 'tax_clearance',
            'name' => 'B tax',
            'status' => 'pending',
            'is_current' => true,
            'version' => 1,
            'storage_path' => 'attachments/vendors/missing.pdf',
        ]);

        $this->asUser($userA)->getJson("/api/v1/procurement/supplier/rfqs/{$rfq->id}")->assertNotFound();
        $this->asUser($userA)->getJson('/api/v1/procurement/supplier/purchase-orders')
            ->assertOk()
            ->assertJsonMissing(['id' => $po->id]);
        $this->asUser($userA)->getJson('/api/v1/procurement/supplier/invoices')
            ->assertOk()
            ->assertJsonMissing(['vendor_invoice_number' => 'INV-B']);
        $this->asUser($userA)->getJson("/api/v1/procurement/supplier/documents/{$doc->id}/download")->assertNotFound();
        $this->asUser($userA)->getJson('/api/v1/procurement/supplier/documents')
            ->assertOk()
            ->assertJsonMissing(['id' => $doc->id]);
    }

    public function test_supplier_rfq_payload_omits_budget_and_evaluation_fields(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asSupplier($tenant);
        $vendor = Vendor::find($user->vendor_id);
        $officer = $this->makeProcurementOfficer($tenant);

        $rfq = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $officer->id,
            'title' => 'Visible RFQ',
            'description' => 'Public description',
            'category' => 'goods',
            'estimated_value' => 99999,
            'currency' => 'NAD',
            'status' => 'approved',
            'justification' => 'secret justification',
            'rfq_issued_at' => now(),
        ]);
        RfqInvitation::create([
            'tenant_id' => $tenant->id,
            'procurement_request_id' => $rfq->id,
            'vendor_id' => $vendor->id,
            'status' => 'pending',
            'invited_at' => now(),
        ]);

        $payload = $http->getJson("/api/v1/procurement/supplier/rfqs/{$rfq->id}")
            ->assertOk()
            ->json('data.request');

        $this->assertArrayNotHasKey('estimated_value', $payload);
        $this->assertArrayNotHasKey('justification', $payload);
        $this->assertArrayNotHasKey('budget_line', $payload);
        $this->assertSame('Visible RFQ', $payload['title']);
    }

    public function test_staff_without_bank_permission_see_masked_account(): void
    {
        $tenant = Tenant::factory()->create();
        $vendor = Vendor::create([
            'tenant_id' => $tenant->id,
            'name' => 'Banked Co',
            'bank_name' => 'FNB',
            'bank_account' => '1234563812',
            'bank_branch' => 'Windhoek',
            'status' => Vendor::STATUS_APPROVED,
        ]);

        $viewer = $this->makeUser('staff', $tenant);
        $viewer->givePermissionTo('procurement.view');

        $payload = $this->asUser($viewer)
            ->getJson("/api/v1/procurement/vendors/{$vendor->id}")
            ->assertOk()
            ->json('data');

        $this->assertSame(BankAccountMasker::mask('1234563812'), $payload['bank_account']);
        $this->assertTrue($payload['bank_account_masked']);
    }

    public function test_submit_application_requires_email_docs_and_declarations(): void
    {
        $tenant = Tenant::factory()->create();
        app(SupplierCatalogueSeeder::class)->ensureForTenant((int) $tenant->id);
        [$http, $user] = $this->asSupplier($tenant, ['email_verified_at' => null]);
        $vendor = Vendor::find($user->vendor_id);
        $vendor->update(['status' => Vendor::STATUS_DRAFT]);

        $http->postJson('/api/v1/procurement/supplier/submit-application')
            ->assertUnprocessable()
            ->assertJsonPath('data.can_submit', false);
    }

    public function test_rejected_supplier_cannot_resubmit_application(): void
    {
        $tenant = Tenant::factory()->create();
        app(SupplierCatalogueSeeder::class)->ensureForTenant((int) $tenant->id);
        [$http, $user] = $this->asSupplier($tenant);
        $vendor = Vendor::find($user->vendor_id);
        $vendor->update(['status' => Vendor::STATUS_REJECTED]);

        $http->postJson('/api/v1/procurement/supplier/submit-application')
            ->assertForbidden();
        $this->assertSame(Vendor::STATUS_REJECTED, $vendor->fresh()->status);
    }

    public function test_staff_without_bank_permission_do_not_see_account_on_banking_change_request(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $supplier] = $this->asSupplier($tenant);
        $vendor = Vendor::find($supplier->vendor_id);
        $vendor->update([
            'status' => Vendor::STATUS_APPROVED,
            'bank_name' => 'FNB',
            'bank_account' => '111122223333',
            'bank_branch' => 'Windhoek',
            'critical_fields_locked_at' => now(),
        ]);

        $http->putJson('/api/v1/procurement/supplier/wizard', [
            'bank_name' => 'Standard Bank',
            'bank_account' => '999988887777',
            'bank_branch' => 'Katutura',
        ])->assertOk();

        $change = SupplierChangeRequest::query()
            ->where('vendor_id', $vendor->id)
            ->where('field_group', SupplierChangeRequest::GROUP_BANKING)
            ->firstOrFail();

        $viewer = $this->makeUser('staff', $tenant);
        $viewer->givePermissionTo(['procurement.view', 'procurement.manage_vendors']);

        $list = $this->asUser($viewer)
            ->getJson("/api/v1/procurement/vendors/{$vendor->id}/change-requests")
            ->assertOk()
            ->json('data.0');

        $this->assertSame(BankAccountMasker::mask('999988887777'), $list['payload']['bank_account'] ?? null);
        $this->assertSame(BankAccountMasker::mask('111122223333'), $list['previous_payload']['bank_account'] ?? null);

        $reject = $this->asUser($viewer)
            ->postJson("/api/v1/procurement/vendors/{$vendor->id}/change-requests/{$change->id}/reject", [
                'remarks' => 'Not acceptable',
            ]);

        $reject->assertForbidden();
        $this->assertStringNotContainsString('999988887777', $reject->getContent());
        $this->assertSame(SupplierChangeRequest::STATUS_PENDING, $change->fresh()->status);
    }
}
