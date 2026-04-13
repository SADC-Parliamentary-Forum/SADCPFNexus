<?php

namespace Tests\Feature\Procurement;

use App\Models\Tenant;
use Illuminate\Http\UploadedFile;
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
            'documents'             => [UploadedFile::fake()->create('company-profile.pdf', 20, 'application/pdf')],
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
            'documents'             => [UploadedFile::fake()->create('tax-clearance.pdf', 20, 'application/pdf')],
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors(['category_ids']);
    }
}
