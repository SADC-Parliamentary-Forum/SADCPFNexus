<?php

namespace Tests\Feature\Procurement;

use App\Mail\ModuleNotificationMail;
use App\Models\ProcurementRequest;
use App\Models\Tenant;
use App\Models\User;
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

        Mail::assertQueued(ModuleNotificationMail::class, function (ModuleNotificationMail $mail) {
            return $mail->hasTo('external@supplier.test')
                && str_contains($mail->notifBody, '/supplier/register')
                && str_contains($mail->notifBody, 'register as a supplier on SADC-PF Nexus');
        });
    }

    public function test_supplier_quote_submission_notifies_procurement_vendor_managers(): void
    {
        Mail::fake();

        $tenant = Tenant::factory()->create();
        $officer = $this->makeProcurementOfficer($tenant);
        $category = $this->makeSupplierCategory($tenant, ['name' => 'ICT Equipment', 'code' => 'ict_equipment']);

        $request = ProcurementRequest::create([
            'tenant_id'       => $tenant->id,
            'requester_id'    => $officer->id,
            'reference_number'=> 'PRQ-NOTIFY-001',
            'title'           => 'Printer Procurement',
            'description'     => 'Procure new printers',
            'category'        => 'goods',
            'estimated_value' => 12000,
            'currency'        => 'NAD',
            'status'          => 'approved',
            'approved_at'     => now(),
            'submitted_at'    => now()->subDay(),
            'rfq_issued_at'   => now(),
        ]);

        $vendor = Vendor::create([
            'tenant_id'     => $tenant->id,
            'name'          => 'Print Hub',
            'contact_name'  => 'Sam Supplier',
            'contact_email' => 'quotes@printhub.test',
            'status'        => 'approved',
            'is_approved'   => true,
            'is_active'     => true,
        ]);
        $vendor->categories()->sync([$category->id]);

        $supplier = User::factory()->create([
            'tenant_id' => $tenant->id,
            'vendor_id' => $vendor->id,
            'email'     => 'supplier@printhub.test',
            'is_active' => true,
        ]);
        $supplier->assignRole('Supplier');

        $invitation = $request->rfqInvitations()->create([
            'tenant_id'           => $tenant->id,
            'vendor_id'           => $vendor->id,
            'invitation_type'     => 'system',
            'status'              => 'sent',
            'invited_name'        => $vendor->contact_name,
            'invited_email'       => $vendor->contact_email,
            'response_token'      => 'quote-token-001',
            'invited_at'          => now(),
            'last_notified_at'    => now(),
            'created_by'          => $officer->id,
        ]);

        $this->asUser($supplier)
            ->postJson("/api/v1/procurement/supplier/rfqs/{$request->id}/quote", [
                'quoted_amount' => 10850.55,
                'currency'      => 'NAD',
                'notes'         => 'Inclusive of delivery',
            ])
            ->assertCreated();

        $this->assertDatabaseHas('procurement_quotes', [
            'rfq_invitation_id' => $invitation->id,
            'vendor_id'         => $vendor->id,
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $officer->id,
            'trigger' => 'supplier.quote_submitted',
        ]);
    }

    public function test_supplier_profile_category_update_notifies_procurement_vendor_managers(): void
    {
        Mail::fake();

        $tenant = Tenant::factory()->create();
        $officer = $this->makeProcurementOfficer($tenant);
        $oldCategory = $this->makeSupplierCategory($tenant, ['name' => 'ICT Equipment', 'code' => 'ict_equipment']);
        $newCategory = $this->makeSupplierCategory($tenant, ['name' => 'Office Supplies', 'code' => 'office_supplies']);

        $vendor = Vendor::create([
            'tenant_id'     => $tenant->id,
            'name'          => 'Profile Update Co',
            'contact_name'  => 'Jordan Supplier',
            'contact_email' => 'hello@profileupdate.test',
            'status'        => 'approved',
            'is_approved'   => true,
            'is_active'     => true,
        ]);
        $vendor->categories()->sync([$oldCategory->id]);

        $supplier = User::factory()->create([
            'tenant_id' => $tenant->id,
            'vendor_id' => $vendor->id,
            'email'     => 'supplier@profileupdate.test',
            'is_active' => true,
        ]);
        $supplier->assignRole('Supplier');

        $this->asUser($supplier)
            ->putJson('/api/v1/procurement/supplier/profile', [
                'category_ids' => [$newCategory->id],
            ])
            ->assertOk();

        $this->assertDatabaseHas('vendors', [
            'id'     => $vendor->id,
            'status' => 'pending_approval',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $officer->id,
            'trigger' => 'supplier.profile_updated',
        ]);
    }
}
