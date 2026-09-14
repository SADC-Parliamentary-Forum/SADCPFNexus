<?php

namespace Tests\Feature\Procurement;

use App\Models\Attachment;
use App\Models\Tenant;
use Tests\TestCase;

class SupplierRegistrationTest extends TestCase
{
    public function test_supplier_can_register_and_is_left_pending_approval(): void
    {
        $tenant = Tenant::factory()->create(['is_active' => true]);
        $category = $this->makeSupplierCategory($tenant, ['name' => 'ICT Equipment', 'code' => 'ict_equipment']);

        $response = $this->post('/api/v1/procurement/suppliers/register', [
            'tenant_id'             => $tenant->id,
            'company_name'          => 'Laptop World',
            'registration_number'   => 'REG-100',
            'tax_number'            => 'TAX-100',
            'contact_name'          => 'Alex Vendor',
            'contact_email'         => 'alex@laptopworld.test',
            'contact_phone'         => '+264000001',
            'address'               => 'Windhoek',
            'country'               => 'Namibia',
            'bank_name'             => 'FNB',
            'bank_account'          => '000123456',
            'bank_branch'           => 'Windhoek',
            'password'              => 'Secret123!',
            'password_confirmation' => 'Secret123!',
            'category_ids'          => [$category->id],
            'documents'             => [$this->fakePdf('company-profile.pdf')],
        ], ['Accept' => 'application/json']);

        $response->assertCreated()
            ->assertJsonPath('data.status', 'pending_approval');

        $this->assertDatabaseHas('vendors', [
            'tenant_id' => $tenant->id,
            'name' => 'Laptop World',
            'status' => 'pending_approval',
            'contact_email' => 'alex@laptopworld.test',
        ]);

        $this->assertDatabaseHas('users', [
            'tenant_id' => $tenant->id,
            'email' => 'alex@laptopworld.test',
            'vendor_id' => $response->json('data.vendor_id'),
            'is_active' => false,
        ]);
    }

    public function test_supplier_registration_rejects_more_than_three_categories(): void
    {
        $tenant = Tenant::factory()->create(['is_active' => true]);
        $categories = collect(range(1, 4))->map(
            fn (int $index) => $this->makeSupplierCategory($tenant, ['name' => "Category {$index}", 'code' => "cat_{$index}"])
        );

        $this->post('/api/v1/procurement/suppliers/register', [
            'tenant_id'             => $tenant->id,
            'company_name'          => 'Overflow Supplier',
            'registration_number'   => 'REG-200',
            'tax_number'            => 'TAX-200',
            'contact_name'          => 'Taylor Vendor',
            'contact_email'         => 'taylor@overflow.test',
            'contact_phone'         => '+264000002',
            'address'               => 'Windhoek',
            'country'               => 'Namibia',
            'bank_name'             => 'FNB',
            'bank_account'          => '000999999',
            'bank_branch'           => 'Windhoek',
            'password'              => 'Secret123!',
            'password_confirmation' => 'Secret123!',
            'category_ids'          => $categories->pluck('id')->all(),
            'documents'             => [$this->fakePdf('tax-clearance.pdf')],
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors(['category_ids']);
    }

    public function test_registered_supplier_appears_in_procurement_vendor_register(): void
    {
        $tenant = Tenant::factory()->create(['is_active' => true]);
        $category = $this->makeSupplierCategory($tenant, ['name' => 'Office Supplies', 'code' => 'office_supplies']);

        $this->post('/api/v1/procurement/suppliers/register', [
            'tenant_id'             => $tenant->id,
            'company_name'          => 'Stationery Hub',
            'registration_number'   => 'REG-300',
            'tax_number'            => 'TAX-300',
            'contact_name'          => 'Casey Vendor',
            'contact_email'         => 'casey@stationeryhub.test',
            'contact_phone'         => '+264000003',
            'address'               => 'Windhoek',
            'country'               => 'Namibia',
            'bank_name'             => 'FNB',
            'bank_account'          => '300300300',
            'bank_branch'           => 'Windhoek',
            'password'              => 'Secret123!',
            'password_confirmation' => 'Secret123!',
            'category_ids'          => [$category->id],
            'documents'             => [$this->fakePdf('company-profile.pdf')],
        ], ['Accept' => 'application/json'])->assertCreated();

        [$http] = $this->asProcurementOfficer($tenant);

        $http->getJson('/api/v1/procurement/vendors')
            ->assertOk()
            ->assertJsonFragment([
                'name'   => 'Stationery Hub',
                'status' => 'pending_approval',
            ]);
    }

    public function test_supplier_registration_stores_multiple_typed_documents_visible_to_procurement(): void
    {
        $tenant = Tenant::factory()->create(['is_active' => true]);
        $category = $this->makeSupplierCategory($tenant, ['name' => 'ICT Equipment', 'code' => 'ict_multi']);

        $response = $this->post('/api/v1/procurement/suppliers/register', [
            'tenant_id'             => $tenant->id,
            'company_name'          => 'Multi Doc Supplies',
            'registration_number'   => 'REG-400',
            'tax_number'            => 'TAX-400',
            'contact_name'          => 'Dana Vendor',
            'contact_email'         => 'dana@multidoc.test',
            'contact_phone'         => '+264000004',
            'address'               => 'Windhoek',
            'country'               => 'Namibia',
            'bank_name'             => 'FNB',
            'bank_account'          => '400400400',
            'bank_branch'           => 'Windhoek',
            'password'              => 'Secret123!',
            'password_confirmation' => 'Secret123!',
            'category_ids'          => [$category->id],
            'documents'             => [
                $this->fakePdf('company-profile.pdf'),
                $this->fakePdf('tax-clearance.pdf'),
                $this->fakePdf('bank-letter.pdf'),
            ],
            'document_types'        => [
                Attachment::DOCUMENT_TYPE_COMPANY_PROFILE,
                Attachment::DOCUMENT_TYPE_TAX_CLEARANCE,
                Attachment::DOCUMENT_TYPE_BANK_DETAILS,
            ],
        ], ['Accept' => 'application/json']);

        $response->assertCreated()
            ->assertJsonPath('data.status', 'pending_approval')
            ->assertJsonCount(3, 'data.documents');

        $this->assertSame('company-profile.pdf', $response->json('data.documents.0.original_filename'));
        $this->assertSame(Attachment::DOCUMENT_TYPE_TAX_CLEARANCE, $response->json('data.documents.1.document_type'));

        $vendorId = (int) $response->json('data.vendor_id');
        $this->assertDatabaseHas('users', [
            'email' => 'dana@multidoc.test',
            'vendor_id' => $vendorId,
            'setup_completed' => true,
        ]);

        [$http] = $this->asProcurementOfficer($tenant);
        $http->getJson("/api/v1/procurement/vendors/{$vendorId}/attachments")
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonFragment(['original_filename' => 'company-profile.pdf'])
            ->assertJsonFragment(['original_filename' => 'tax-clearance.pdf'])
            ->assertJsonFragment(['original_filename' => 'bank-letter.pdf']);
    }

    public function test_supplier_registration_requires_captcha_when_enabled(): void
    {
        config(['captcha.enabled' => true, 'captcha.turnstile_secret' => null, 'captcha.hcaptcha_secret' => null]);

        $tenant = Tenant::factory()->create(['is_active' => true]);
        $category = $this->makeSupplierCategory($tenant, ['name' => 'ICT Equipment', 'code' => 'ict_captcha']);

        $this->post('/api/v1/procurement/suppliers/register', [
            'tenant_id'             => $tenant->id,
            'company_name'          => 'Captcha Supplies',
            'registration_number'   => 'REG-500',
            'tax_number'            => 'TAX-500',
            'contact_name'          => 'Evan Vendor',
            'contact_email'         => 'evan@captcha.test',
            'contact_phone'         => '+264000005',
            'address'               => 'Windhoek',
            'country'               => 'Namibia',
            'bank_name'             => 'FNB',
            'bank_account'          => '500500500',
            'bank_branch'           => 'Windhoek',
            'password'              => 'Secret123!',
            'password_confirmation' => 'Secret123!',
            'category_ids'          => [$category->id],
            'documents'             => [$this->fakePdf('company-profile.pdf')],
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['captcha_token']);
    }

    public function test_supplier_registration_succeeds_with_issued_captcha_token(): void
    {
        config(['captcha.enabled' => true, 'captcha.turnstile_secret' => null, 'captcha.hcaptcha_secret' => null]);

        $tenant = Tenant::factory()->create(['is_active' => true]);
        $category = $this->makeSupplierCategory($tenant, ['name' => 'ICT Equipment', 'code' => 'ict_captcha_ok']);
        $token = $this->postJson('/api/v1/auth/captcha-challenge')->json('token');

        $this->post('/api/v1/procurement/suppliers/register', [
            'tenant_id'             => $tenant->id,
            'company_name'          => 'Captcha Ok Supplies',
            'registration_number'   => 'REG-502',
            'tax_number'            => 'TAX-502',
            'contact_name'          => 'Gina Vendor',
            'contact_email'         => 'gina@captchaok.test',
            'contact_phone'         => '+264000016',
            'address'               => 'Windhoek',
            'country'               => 'Namibia',
            'bank_name'             => 'FNB',
            'bank_account'          => '502502502',
            'bank_branch'           => 'Windhoek',
            'password'              => 'Secret123!',
            'password_confirmation' => 'Secret123!',
            'category_ids'          => [$category->id],
            'documents'             => [$this->fakePdf('company-profile.pdf')],
            'captcha_token'         => $token,
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonCount(1, 'data.documents');
    }

    public function test_supplier_registration_does_not_skip_captcha_for_mobile_client_type(): void
    {
        config(['captcha.enabled' => true, 'captcha.turnstile_secret' => null, 'captcha.hcaptcha_secret' => null]);

        $tenant = Tenant::factory()->create(['is_active' => true]);
        $category = $this->makeSupplierCategory($tenant, ['name' => 'ICT Equipment', 'code' => 'ict_mobile_captcha']);

        $this->post('/api/v1/procurement/suppliers/register', [
            'tenant_id'             => $tenant->id,
            'company_name'          => 'Mobile Captcha Supplies',
            'registration_number'   => 'REG-501',
            'tax_number'            => 'TAX-501',
            'contact_name'          => 'Evan Mobile',
            'contact_email'         => 'evan.mobile@captcha.test',
            'contact_phone'         => '+264000015',
            'address'               => 'Windhoek',
            'country'               => 'Namibia',
            'bank_name'             => 'FNB',
            'bank_account'          => '501501501',
            'bank_branch'           => 'Windhoek',
            'password'              => 'Secret123!',
            'password_confirmation' => 'Secret123!',
            'category_ids'          => [$category->id],
            'documents'             => [$this->fakePdf('company-profile.pdf')],
            'client_type'           => 'mobile',
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['captcha_token']);
    }

    public function test_supplier_registration_rejects_more_than_fifteen_documents(): void
    {
        $tenant = Tenant::factory()->create(['is_active' => true]);
        $category = $this->makeSupplierCategory($tenant, ['name' => 'ICT Equipment', 'code' => 'ict_limit']);

        $documents = [];
        for ($i = 1; $i <= 16; $i++) {
            $documents[] = $this->fakePdf("doc-{$i}.pdf");
        }

        $this->post('/api/v1/procurement/suppliers/register', [
            'tenant_id'             => $tenant->id,
            'company_name'          => 'Overflow Docs',
            'registration_number'   => 'REG-600',
            'tax_number'            => 'TAX-600',
            'contact_name'          => 'Fran Vendor',
            'contact_email'         => 'fran@overflowdocs.test',
            'contact_phone'         => '+264000006',
            'address'               => 'Windhoek',
            'country'               => 'Namibia',
            'bank_name'             => 'FNB',
            'bank_account'          => '600600600',
            'bank_branch'           => 'Windhoek',
            'password'              => 'Secret123!',
            'password_confirmation' => 'Secret123!',
            'category_ids'          => [$category->id],
            'documents'             => $documents,
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['documents']);
    }
}
