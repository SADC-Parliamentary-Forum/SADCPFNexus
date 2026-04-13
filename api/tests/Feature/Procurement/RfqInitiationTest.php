<?php

namespace Tests\Feature\Procurement;

use App\Models\ProcurementRequest;
use App\Models\Tenant;
use App\Models\Vendor;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class RfqInitiationTest extends TestCase
{
    public function test_issue_rfq_targets_matching_approved_suppliers_and_external_email_invites(): void
    {
        Mail::fake();

        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);

        $category = $this->makeSupplierCategory($tenant, ['name' => 'ICT Equipment', 'code' => 'ict_equipment']);
        $otherCategory = $this->makeSupplierCategory($tenant, ['name' => 'Logistics', 'code' => 'logistics']);

        $request = ProcurementRequest::create([
            'tenant_id'       => $tenant->id,
            'requester_id'    => $officer->id,
            'title'           => 'Laptop Procurement',
            'description'     => 'Procure laptops for programme staff',
            'category'        => 'goods',
            'estimated_value' => 45000,
            'currency'        => 'NAD',
            'status'          => 'approved',
            'approved_at'     => now(),
            'submitted_at'    => now()->subDay(),
        ]);

        $matchingVendor = Vendor::create([
            'tenant_id'     => $tenant->id,
            'name'          => 'Laptop World',
            'contact_email' => 'quotes@laptopworld.test',
            'status'        => 'approved',
            'is_approved'   => true,
            'is_active'     => true,
        ]);
        $matchingVendor->categories()->sync([$category->id]);

        $nonMatchingVendor = Vendor::create([
            'tenant_id'     => $tenant->id,
            'name'          => 'Road Runner',
            'contact_email' => 'quotes@roadrunner.test',
            'status'        => 'approved',
            'is_approved'   => true,
            'is_active'     => true,
        ]);
        $nonMatchingVendor->categories()->sync([$otherCategory->id]);

        $http->postJson("/api/v1/procurement/requests/{$request->id}/issue-rfq", [
            'category_ids' => [$category->id],
            'rfq_deadline' => now()->addDays(5)->toDateString(),
            'rfq_notes' => 'Submit branded laptop quotations.',
            'external_invites' => [
                ['name' => 'Email Only Supplier', 'email' => 'external@supplier.test'],
            ],
        ])->assertOk()->assertJsonPath('data.rfq_issued_by', $officer->id);

        $this->assertDatabaseHas('rfq_invitations', [
            'procurement_request_id' => $request->id,
            'vendor_id' => $matchingVendor->id,
            'invitation_type' => 'system',
            'status' => 'sent',
        ]);
        $this->assertDatabaseMissing('rfq_invitations', [
            'procurement_request_id' => $request->id,
            'vendor_id' => $nonMatchingVendor->id,
        ]);
        $this->assertDatabaseHas('rfq_invitations', [
            'procurement_request_id' => $request->id,
            'vendor_id' => null,
            'invited_email' => 'external@supplier.test',
            'invitation_type' => 'email',
        ]);
    }
}
