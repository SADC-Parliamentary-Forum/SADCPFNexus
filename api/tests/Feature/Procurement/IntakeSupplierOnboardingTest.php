<?php

namespace Tests\Feature\Procurement;

use App\Models\AccountInvitation;
use App\Models\Notification;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Http\UploadedFile;
use Tests\Support\InvoicePdfFixture;
use Tests\TestCase;

class IntakeSupplierOnboardingTest extends TestCase
{
    private function pdfFile(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('Invoice_INV0001.pdf', InvoicePdfFixture::inv0001Pdf());
    }

    public function test_unmatched_invoice_upload_returns_no_vendor(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asProcurementOfficer($tenant);

        $res = $http->post('/api/v1/procurement/intakes', ['file' => $this->pdfFile()], ['Accept' => 'application/json']);
        $res->assertCreated();
        $this->assertNull($res->json('data.vendor_id'));
        $this->assertSame('unmatched', $res->json('data.supplier_match_status'));
        $this->assertNotEmpty($res->json('data.supplier_name_raw'));
        $this->assertIsArray($res->json('data.supplier_candidates'));
    }

    public function test_officer_creates_supplier_from_intake_and_sends_login_invitation_without_password(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asProcurementOfficer($tenant);
        $category = $this->makeSupplierCategory($tenant, ['name' => 'Facilities']);

        $intakeId = $http->post('/api/v1/procurement/intakes', ['file' => $this->pdfFile()])
            ->assertCreated()
            ->json('data.id');

        $email = 'jvj.portal.'.uniqid().'@example.test';
        $res = $http->postJson("/api/v1/procurement/intakes/{$intakeId}/supplier", [
            'name' => 'JVJ Plumbing Services',
            'contact_name' => 'Julius',
            'contact_email' => $email,
            'contact_phone' => '0813649656',
            'tax_number' => null,
            'registration_number' => null,
            'address' => 'Markus Shipyard Street, Windhoek',
            'country' => 'Namibia',
            'category_ids' => [$category->id],
            'send_invitation' => true,
        ]);

        $res->assertCreated();
        $this->assertNotEmpty($res->json('data.vendor_id'));
        $this->assertSame('created_from_document', $res->json('data.supplier_match_status'));
        $this->assertSame('JVJ Plumbing Services', $res->json('data.vendor.name'));
        $this->assertTrue((bool) $res->json('invitation.sent'));
        $this->assertSame($email, $res->json('invitation.email'));
        $this->assertFalse((bool) $res->json('invitation.password_emailed'));
        $this->assertStringContainsString('/login', (string) $res->json('invitation.login_url'));
        $this->assertStringContainsString('activate-account', (string) $res->json('invitation.activation_hint'));
        $this->assertArrayNotHasKey('password', $res->json('invitation') ?? []);
        $this->assertArrayNotHasKey('password', $res->json('data') ?? []);

        $vendor = Vendor::find($res->json('data.vendor_id'));
        $this->assertNotNull($vendor);
        $this->assertSame('pending_approval', $vendor->status);
        $this->assertFalse((bool) $vendor->is_approved);

        $portalUser = User::where('email', $email)->first();
        $this->assertNotNull($portalUser);
        $this->assertSame($vendor->id, (int) $portalUser->vendor_id);
        $this->assertFalse((bool) $portalUser->is_active);
        $this->assertSame(User::STATUS_INVITED, $portalUser->account_status);
        $this->assertTrue($portalUser->hasAnyRole(['Supplier', 'External Supplier']));

        $this->assertDatabaseHas('account_invitations', [
            'user_id' => $portalUser->id,
            'email' => $email,
            'status' => AccountInvitation::STATUS_PENDING,
        ]);

        $note = Notification::query()->where('user_id', $portalUser->id)->latest('id')->first();
        $this->assertNotNull($note);
        $this->assertSame('supplier.portal_invited', $note->trigger);
        $this->assertStringContainsString('activate', strtolower((string) $note->body));
        $this->assertStringContainsString('/login', (string) $note->body);
        $this->assertDoesNotMatchRegularExpression('/password\\s*[:=]/i', (string) $note->body);
        $this->assertStringContainsString('never email you a password', strtolower((string) $note->body));
    }

    public function test_staff_cannot_create_supplier_from_intake(): void
    {
        $tenant = Tenant::factory()->create();
        [$officerHttp] = $this->asProcurementOfficer($tenant);
        $intakeId = $officerHttp->post('/api/v1/procurement/intakes', ['file' => $this->pdfFile()])->json('data.id');

        [$staffHttp] = $this->asStaff($tenant);
        $staffHttp->postJson("/api/v1/procurement/intakes/{$intakeId}/supplier", [
            'name' => 'Ghost Supplier',
            'contact_email' => 'ghost@example.test',
            'category_ids' => [$this->makeSupplierCategory($tenant)->id],
        ])->assertForbidden();
    }

    public function test_officer_can_link_similar_existing_vendor_instead_of_creating(): void
    {
        $tenant = Tenant::factory()->create();
        $existing = Vendor::create([
            'tenant_id' => $tenant->id,
            'name' => 'Other Plumbing CC',
            'contact_email' => 'other@example.test',
            'is_approved' => true,
            'is_active' => true,
            'status' => 'approved',
        ]);
        [$http] = $this->asProcurementOfficer($tenant);
        $intakeId = $http->post('/api/v1/procurement/intakes', ['file' => $this->pdfFile()])->json('data.id');

        $res = $http->postJson("/api/v1/procurement/intakes/{$intakeId}/supplier", [
            'vendor_id' => $existing->id,
            'send_invitation' => false,
        ]);
        $res->assertOk();
        $this->assertSame($existing->id, (int) $res->json('data.vendor_id'));
        $this->assertSame('user_selected', $res->json('data.supplier_match_status'));
        $this->assertFalse((bool) $res->json('invitation.sent'));
        $this->assertSame(1, Vendor::query()->where('tenant_id', $tenant->id)->count());
    }

    public function test_cannot_link_vendor_from_another_tenant(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();
        $foreign = Vendor::create([
            'tenant_id' => $tenantB->id,
            'name' => 'Foreign Vendor',
            'is_approved' => true,
            'is_active' => true,
        ]);
        [$http] = $this->asProcurementOfficer($tenantA);
        $intakeId = $http->post('/api/v1/procurement/intakes', ['file' => $this->pdfFile()])->json('data.id');

        $http->postJson("/api/v1/procurement/intakes/{$intakeId}/supplier", [
            'vendor_id' => $foreign->id,
            'send_invitation' => false,
        ])->assertNotFound();
    }

    public function test_invite_is_skipped_when_officer_opts_out(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asProcurementOfficer($tenant);
        $category = $this->makeSupplierCategory($tenant);
        $intakeId = $http->post('/api/v1/procurement/intakes', ['file' => $this->pdfFile()])->json('data.id');

        $email = 'no-invite.'.uniqid().'@example.test';
        $res = $http->postJson("/api/v1/procurement/intakes/{$intakeId}/supplier", [
            'name' => 'One-off Supplier',
            'contact_email' => $email,
            'category_ids' => [$category->id],
            'send_invitation' => false,
        ]);
        $res->assertCreated();
        $this->assertFalse((bool) $res->json('invitation.sent'));
        $this->assertDatabaseMissing('users', ['email' => $email]);
    }

    public function test_cannot_invite_using_an_existing_staff_email(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $category = $this->makeSupplierCategory($tenant);
        $intakeId = $http->post('/api/v1/procurement/intakes', ['file' => $this->pdfFile()])->json('data.id');

        $http->postJson("/api/v1/procurement/intakes/{$intakeId}/supplier", [
            'name' => 'Conflict Supplier',
            'contact_email' => $officer->email,
            'category_ids' => [$category->id],
            'send_invitation' => true,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['contact_email']);
    }

    public function test_create_requires_name_and_category_when_not_linking(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asProcurementOfficer($tenant);
        $intakeId = $http->post('/api/v1/procurement/intakes', ['file' => $this->pdfFile()])->json('data.id');

        $http->postJson("/api/v1/procurement/intakes/{$intakeId}/supplier", [
            'send_invitation' => false,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'category_ids']);
    }
}
