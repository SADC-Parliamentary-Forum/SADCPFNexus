<?php

namespace Tests\Feature\Procurement;

use App\Models\SupplierChangeRequest;
use App\Models\SupplierDocument;
use App\Models\Tenant;
use App\Models\Vendor;
use App\Modules\Procurement\Services\SupplierCatalogueSeeder;
use App\Modules\Procurement\Services\SupplierComplianceMonitor;
use Tests\TestCase;

class SupplierDocumentRegisterTest extends TestCase
{
    public function test_document_upload_versions_and_officer_stamp(): void
    {
        $tenant = Tenant::factory()->create();
        app(SupplierCatalogueSeeder::class)->ensureForTenant((int) $tenant->id);
        [$http, $supplier] = $this->asSupplier($tenant);
        $vendor = Vendor::find($supplier->vendor_id);

        $upload = $http->post('/api/v1/procurement/supplier/documents', [
            'file' => $this->fakePdf('tax-v1.pdf'),
            'type_code' => 'tax_clearance',
            'expiry_date' => now()->addYear()->toDateString(),
        ], ['Accept' => 'application/json']);

        $upload->assertCreated();
        $firstId = $upload->json('data.id');
        $this->assertSame(1, $upload->json('data.version'));
        $this->assertSame('pending', $upload->json('data.status'));

        $http->post('/api/v1/procurement/supplier/documents', [
            'file' => $this->fakePdf('tax-v2.pdf'),
            'type_code' => 'tax_clearance',
            'expiry_date' => now()->addYear()->toDateString(),
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.version', 2);

        $this->assertFalse((bool) SupplierDocument::find($firstId)->is_current);

        [$officerHttp, $officer] = $this->asProcurementOfficer($tenant);
        $current = SupplierDocument::query()->where('vendor_id', $vendor->id)->where('is_current', true)->first();
        $officerHttp->postJson("/api/v1/procurement/vendors/{$vendor->id}/register-documents/{$current->id}/verify", [
            'remarks' => 'Checked against original',
        ])->assertOk()->assertJsonPath('data.status', 'verified');

        $this->assertSame($officer->id, $current->fresh()->verified_by);
        $this->assertNotNull($current->fresh()->verified_at);
    }

    public function test_supplier_navigation_includes_documents_menu(): void
    {
        [$http] = $this->asSupplier();

        $items = $http->getJson('/api/v1/access/navigation')->assertOk()->json('data.items');
        $portal = collect($items)->firstWhere('href', '/supplier');
        $this->assertNotNull($portal);
        $hrefs = collect($portal['children'] ?? [])->pluck('href')->all();
        $this->assertContains('/supplier/documents', $hrefs);
        $this->assertContains('/supplier/profile', $hrefs);
    }

    public function test_supplier_document_index_returns_checklist_without_storage_paths(): void
    {
        $tenant = Tenant::factory()->create();
        app(SupplierCatalogueSeeder::class)->ensureForTenant((int) $tenant->id);
        [$http] = $this->asSupplier($tenant);

        $payload = $http->getJson('/api/v1/procurement/supplier/documents')
            ->assertOk()
            ->json('data');

        $this->assertIsArray($payload['types'] ?? null);
        $this->assertIsArray($payload['requirements'] ?? null);
        $this->assertIsArray($payload['documents'] ?? null);
        $this->assertNotEmpty($payload['types']);
        $this->assertNotEmpty($payload['requirements']);

        $tax = collect($payload['requirements'])->firstWhere('code', 'tax_clearance');
        $this->assertNotNull($tax);
        $this->assertTrue($tax['needed']);
        $this->assertSame('needed', $tax['status']);

        $encoded = json_encode($payload);
        $this->assertIsString($encoded);
        $this->assertStringNotContainsString('storage_path', $encoded);
        $this->assertStringNotContainsString('attachments/vendors', $encoded);

        $codes = collect($payload['types'])->pluck('code')->all();
        $this->assertContains('tax_clearance', $codes);
        $this->assertContains('other', $codes);
        $other = collect($payload['types'])->firstWhere('code', 'other');
        $this->assertTrue($other['allows_multiple']);
        $this->assertFalse(collect($payload['types'])->firstWhere('code', 'tax_clearance')['allows_multiple']);
    }

    public function test_other_uploads_stay_current_while_typed_docs_are_versioned(): void
    {
        $tenant = Tenant::factory()->create();
        app(SupplierCatalogueSeeder::class)->ensureForTenant((int) $tenant->id);
        [$http] = $this->asSupplier($tenant);

        $http->post('/api/v1/procurement/supplier/documents', [
            'file' => $this->fakePdf('support-1.pdf'),
            'type_code' => 'other',
        ], ['Accept' => 'application/json'])->assertCreated();

        $http->post('/api/v1/procurement/supplier/documents', [
            'file' => $this->fakePdf('support-2.pdf'),
            'type_code' => 'other',
        ], ['Accept' => 'application/json'])->assertCreated();

        $this->assertSame(
            2,
            SupplierDocument::query()->where('type_code', 'other')->where('is_current', true)->count()
        );

        $firstTax = $http->post('/api/v1/procurement/supplier/documents', [
            'file' => $this->fakePdf('tax-v1.pdf'),
            'type_code' => 'tax_clearance',
            'expiry_date' => now()->addYear()->toDateString(),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');

        $http->post('/api/v1/procurement/supplier/documents', [
            'file' => $this->fakePdf('tax-v2.pdf'),
            'type_code' => 'tax_clearance',
            'expiry_date' => now()->addYear()->toDateString(),
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.version', 2);

        $this->assertFalse((bool) SupplierDocument::find($firstTax)->is_current);

        $list = $http->getJson('/api/v1/procurement/supplier/documents')->assertOk()->json('data');
        $this->assertCount(2, collect($list['documents'])->where('type_code', 'other')->all());
        $taxReq = collect($list['requirements'])->firstWhere('code', 'tax_clearance');
        $this->assertFalse($taxReq['needed']);
        $this->assertSame('pending', $taxReq['status']);
        $this->assertStringNotContainsString('storage_path', (string) json_encode($list));
    }

    public function test_tax_clearance_upload_requires_expiry_date(): void
    {
        $tenant = Tenant::factory()->create();
        app(SupplierCatalogueSeeder::class)->ensureForTenant((int) $tenant->id);
        [$http] = $this->asSupplier($tenant);

        $http->post('/api/v1/procurement/supplier/documents', [
            'file' => $this->fakePdf('tax-missing-expiry.pdf'),
            'type_code' => 'tax_clearance',
        ], ['Accept' => 'application/json'])->assertUnprocessable();

        $http->post('/api/v1/procurement/supplier/documents', [
            'file' => $this->fakePdf('tax-with-expiry.pdf'),
            'type_code' => 'tax_clearance',
            'expiry_date' => now()->addYear()->toDateString(),
        ], ['Accept' => 'application/json'])->assertCreated();
    }

    public function test_critical_bank_change_queues_request_after_approval(): void
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

        $this->assertDatabaseHas('supplier_change_requests', [
            'vendor_id' => $vendor->id,
            'field_group' => SupplierChangeRequest::GROUP_BANKING,
            'status' => SupplierChangeRequest::STATUS_PENDING,
        ]);
        $this->assertSame('111122223333', $vendor->fresh()->bank_account);
    }

    public function test_approved_supplier_category_change_queues_request(): void
    {
        $tenant = Tenant::factory()->create();
        $old = $this->makeSupplierCategory($tenant, ['name' => 'ICT Equipment', 'code' => 'ict_locked']);
        $new = $this->makeSupplierCategory($tenant, ['name' => 'Office Supplies', 'code' => 'office_locked']);
        [$http, $supplier] = $this->asSupplier($tenant);
        $vendor = Vendor::find($supplier->vendor_id);
        $vendor->update([
            'status' => Vendor::STATUS_APPROVED,
            'critical_fields_locked_at' => now(),
        ]);
        $vendor->categories()->sync([$old->id]);

        $http->putJson('/api/v1/procurement/supplier/wizard', [
            'category_ids' => [$new->id],
        ])->assertOk();

        $this->assertEqualsCanonicalizing([$old->id], $vendor->fresh()->categories()->pluck('supplier_categories.id')->all());
        $this->assertDatabaseHas('supplier_change_requests', [
            'vendor_id' => $vendor->id,
            'field_group' => SupplierChangeRequest::GROUP_CATEGORIES,
            'status' => SupplierChangeRequest::STATUS_PENDING,
        ]);
    }

    public function test_expiry_monitor_notifies_and_is_idempotent_per_window(): void
    {
        $tenant = Tenant::factory()->create();
        app(SupplierCatalogueSeeder::class)->ensureForTenant((int) $tenant->id);
        [$http, $supplier] = $this->asSupplier($tenant);
        $vendor = Vendor::find($supplier->vendor_id);
        $vendor->update(['status' => Vendor::STATUS_APPROVED]);

        SupplierDocument::create([
            'tenant_id' => $tenant->id,
            'vendor_id' => $vendor->id,
            'type_code' => 'tax_clearance',
            'name' => 'Tax',
            'expiry_date' => now()->addDays(10)->toDateString(),
            'status' => SupplierDocument::STATUS_VERIFIED,
            'is_current' => true,
            'version' => 1,
        ]);

        $monitor = app(SupplierComplianceMonitor::class);
        $first = $monitor->run();
        $second = $monitor->run();
        $this->assertGreaterThan(0, $first);
        $this->assertSame(0, $second);
    }

    public function test_category_parent_must_belong_to_the_same_tenant(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();
        $foreign = $this->makeSupplierCategory($tenantB, ['name' => 'Foreign Parent', 'code' => 'foreign_parent']);
        [$http] = $this->asProcurementOfficer($tenantA);

        $http->postJson('/api/v1/procurement/supplier-categories', [
            'name' => 'Child of foreign',
            'parent_id' => $foreign->id,
        ])->assertUnprocessable();
    }
}
