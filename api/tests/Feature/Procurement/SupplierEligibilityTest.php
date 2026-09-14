<?php

namespace Tests\Feature\Procurement;

use App\Models\ProcurementRequest;
use App\Models\RfqInvitation;
use App\Models\SupplierDocument;
use App\Models\SupplierDocumentRequirementType;
use App\Models\Tenant;
use App\Models\Vendor;
use App\Modules\Procurement\Services\SupplierCatalogueSeeder;
use App\Modules\Procurement\Services\SupplierComplianceMonitor;
use App\Modules\Procurement\Services\SupplierEligibilityService;
use Tests\TestCase;

class SupplierEligibilityTest extends TestCase
{
    public function test_approved_vendor_with_expired_mandatory_tax_cannot_quote_until_override(): void
    {
        $tenant = Tenant::factory()->create();
        app(SupplierCatalogueSeeder::class)->ensureForTenant((int) $tenant->id);

        $vendor = Vendor::create([
            'tenant_id' => $tenant->id,
            'name' => 'Tax Expired Co',
            'country' => 'Namibia',
            'status' => Vendor::STATUS_APPROVED,
            'is_approved' => true,
            'is_active' => true,
        ]);

        $tax = SupplierDocumentRequirementType::query()
            ->where('tenant_id', $tenant->id)
            ->where('code', 'tax_clearance')
            ->firstOrFail();

        SupplierDocument::create([
            'tenant_id' => $tenant->id,
            'vendor_id' => $vendor->id,
            'requirement_type_id' => $tax->id,
            'type_code' => 'tax_clearance',
            'name' => 'Tax clearance',
            'expiry_date' => now()->subDay()->toDateString(),
            'status' => SupplierDocument::STATUS_VERIFIED,
            'is_current' => true,
            'version' => 1,
        ]);

        foreach (['registration_certificate', 'bank_details'] as $code) {
            $type = SupplierDocumentRequirementType::query()->where('tenant_id', $tenant->id)->where('code', $code)->firstOrFail();
            SupplierDocument::create([
                'tenant_id' => $tenant->id,
                'vendor_id' => $vendor->id,
                'requirement_type_id' => $type->id,
                'type_code' => $code,
                'name' => $code,
                'status' => SupplierDocument::STATUS_VERIFIED,
                'is_current' => true,
                'version' => 1,
            ]);
        }

        app(SupplierComplianceMonitor::class)->flipComplianceWarnings();
        $vendor->refresh();
        $this->assertSame(Vendor::STATUS_COMPLIANCE_WARNING, $vendor->normalizedStatus());

        $evaluation = app(SupplierEligibilityService::class)->evaluate($vendor);
        $this->assertSame('non_compliant', $evaluation['compliance_status']);
        $this->assertFalse($evaluation['can_submit_quotes']);

        $officer = $this->makeProcurementOfficer($tenant);
        $rfq = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $officer->id,
            'title' => 'RFQ with override',
            'description' => 'Eligibility override',
            'category' => 'goods',
            'estimated_value' => 1000,
            'currency' => 'NAD',
            'status' => 'approved',
            'rfq_issued_at' => now(),
        ]);
        $invitation = RfqInvitation::create([
            'tenant_id' => $tenant->id,
            'procurement_request_id' => $rfq->id,
            'vendor_id' => $vendor->id,
            'invitation_type' => 'system',
            'status' => 'pending',
            'invited_at' => now(),
        ]);

        $blocked = app(SupplierEligibilityService::class)->evaluate($vendor, $rfq, $invitation);
        $this->assertFalse($blocked['can_submit_quotes']);

        $invitation->update(['eligibility_override' => true]);
        $allowed = app(SupplierEligibilityService::class)->evaluate($vendor, $rfq, $invitation->fresh());
        $this->assertTrue($allowed['can_submit_quotes']);
        $this->assertTrue($allowed['override_applied']);
    }

    public function test_conditionally_approved_vendor_with_valid_docs_can_quote(): void
    {
        $tenant = Tenant::factory()->create();
        $vendor = Vendor::create([
            'tenant_id' => $tenant->id,
            'name' => 'Conditional Co',
            'status' => Vendor::STATUS_CONDITIONALLY_APPROVED,
        ]);

        $evaluation = app(SupplierEligibilityService::class)->evaluate($vendor);
        $this->assertTrue($evaluation['can_submit_quotes']);
        $this->assertSame('valid', $evaluation['compliance_status']);
    }

    public function test_legacy_flags_approved_only_for_approved_status(): void
    {
        $tenant = Tenant::factory()->create();
        $vendor = Vendor::create([
            'tenant_id' => $tenant->id,
            'name' => 'Warning Co',
            'status' => Vendor::STATUS_COMPLIANCE_WARNING,
        ]);
        $vendor->syncLegacyFlagsFromStatus();
        $vendor->save();

        $this->assertFalse((bool) $vendor->is_approved);
        $this->assertTrue((bool) $vendor->is_active);
        $this->assertFalse((bool) $vendor->is_blacklisted);
    }

    public function test_debarred_maps_from_blacklisted_and_cannot_quote(): void
    {
        $tenant = Tenant::factory()->create();
        $vendor = Vendor::create([
            'tenant_id' => $tenant->id,
            'name' => 'Debarred Co',
            'status' => 'blacklisted',
        ]);
        $this->assertSame(Vendor::STATUS_DEBARRED, $vendor->fresh()->status);
        $this->assertFalse(app(SupplierEligibilityService::class)->evaluate($vendor->fresh())['can_submit_quotes']);
    }

    public function test_rfq_eligibility_override_allows_quote_submit_during_compliance_warning(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asSupplier($tenant);
        $vendor = Vendor::find($user->vendor_id);
        $vendor->update(['status' => Vendor::STATUS_COMPLIANCE_WARNING]);
        $officer = $this->makeProcurementOfficer($tenant);

        $rfq = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $officer->id,
            'title' => 'Override quote RFQ',
            'description' => 'Portal quote',
            'category' => 'goods',
            'estimated_value' => 1000,
            'currency' => 'NAD',
            'status' => 'approved',
            'rfq_issued_at' => now(),
            'rfq_deadline' => now()->addDays(7)->toDateString(),
        ]);
        $invitation = RfqInvitation::create([
            'tenant_id' => $tenant->id,
            'procurement_request_id' => $rfq->id,
            'vendor_id' => $vendor->id,
            'invitation_type' => 'system',
            'status' => 'pending',
            'invited_at' => now(),
        ]);

        $http->postJson("/api/v1/procurement/supplier/rfqs/{$rfq->id}/quote", [
            'quoted_amount' => 250,
            'currency' => 'NAD',
        ])->assertForbidden();

        $invitation->update(['eligibility_override' => true]);

        $http->postJson("/api/v1/procurement/supplier/rfqs/{$rfq->id}/quote", [
            'quoted_amount' => 250,
            'currency' => 'NAD',
        ])->assertCreated();
    }

    public function test_compliance_warning_restore_keeps_conditional_approval(): void
    {
        $tenant = Tenant::factory()->create();
        app(SupplierCatalogueSeeder::class)->ensureForTenant((int) $tenant->id);

        $vendor = Vendor::create([
            'tenant_id' => $tenant->id,
            'name' => 'Conditional Restore Co',
            'country' => 'Namibia',
            'status' => Vendor::STATUS_CONDITIONALLY_APPROVED,
            'approved_at' => now(),
            'is_approved' => false,
            'is_active' => true,
        ]);

        $tax = SupplierDocumentRequirementType::query()
            ->where('tenant_id', $tenant->id)
            ->where('code', 'tax_clearance')
            ->firstOrFail();

        $doc = SupplierDocument::create([
            'tenant_id' => $tenant->id,
            'vendor_id' => $vendor->id,
            'requirement_type_id' => $tax->id,
            'type_code' => 'tax_clearance',
            'name' => 'Tax clearance',
            'expiry_date' => now()->subDay()->toDateString(),
            'status' => SupplierDocument::STATUS_VERIFIED,
            'is_current' => true,
            'version' => 1,
        ]);

        foreach (['registration_certificate', 'bank_details'] as $code) {
            $type = SupplierDocumentRequirementType::query()->where('tenant_id', $tenant->id)->where('code', $code)->firstOrFail();
            SupplierDocument::create([
                'tenant_id' => $tenant->id,
                'vendor_id' => $vendor->id,
                'requirement_type_id' => $type->id,
                'type_code' => $code,
                'name' => $code,
                'status' => SupplierDocument::STATUS_VERIFIED,
                'is_current' => true,
                'version' => 1,
            ]);
        }

        app(SupplierComplianceMonitor::class)->flipComplianceWarnings();
        $this->assertSame(Vendor::STATUS_COMPLIANCE_WARNING, $vendor->fresh()->status);

        $doc->update(['expiry_date' => now()->addYear()->toDateString()]);
        app(SupplierComplianceMonitor::class)->flipComplianceWarnings();

        $this->assertSame(Vendor::STATUS_CONDITIONALLY_APPROVED, $vendor->fresh()->status);
        $this->assertFalse((bool) $vendor->fresh()->is_approved);
    }

    public function test_funding_source_extra_requires_verification_when_configured(): void
    {
        $tenant = Tenant::factory()->create();
        $vendor = Vendor::create([
            'tenant_id' => $tenant->id,
            'name' => 'Donor Docs Co',
            'status' => Vendor::STATUS_APPROVED,
            'is_approved' => true,
            'is_active' => true,
        ]);

        $type = SupplierDocumentRequirementType::create([
            'tenant_id' => $tenant->id,
            'code' => 'eu_declaration',
            'label' => 'EU declaration',
            'mandatory' => false,
            'required_for_rfq' => false,
            'funding_source' => 'EU',
            'requires_verification' => true,
            'is_active' => true,
            'sort_order' => 90,
        ]);

        SupplierDocument::create([
            'tenant_id' => $tenant->id,
            'vendor_id' => $vendor->id,
            'requirement_type_id' => $type->id,
            'type_code' => $type->code,
            'name' => 'EU declaration',
            'status' => SupplierDocument::STATUS_PENDING,
            'is_current' => true,
            'version' => 1,
        ]);

        $officer = $this->makeProcurementOfficer($tenant);
        $rfq = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $officer->id,
            'title' => 'EU-funded RFQ',
            'description' => 'Funding extras',
            'category' => 'goods',
            'estimated_value' => 1000,
            'currency' => 'NAD',
            'status' => 'approved',
            'rfq_issued_at' => now(),
        ]);
        $rfq->funding_source = 'EU';

        $evaluation = app(SupplierEligibilityService::class)->evaluate($vendor, $rfq);
        $this->assertFalse($evaluation['can_submit_quotes']);
        $this->assertContains('funding_source_documents', $evaluation['reasons']);
        $this->assertFalse($evaluation['funding_source_extras'][0]['satisfied']);
    }
}
