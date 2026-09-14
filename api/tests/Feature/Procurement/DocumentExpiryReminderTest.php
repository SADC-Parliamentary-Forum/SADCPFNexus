<?php

namespace Tests\Feature\Procurement;

use App\Models\SupplierDocument;
use App\Models\Tenant;
use App\Models\Vendor;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class DocumentExpiryReminderTest extends TestCase
{
    public function test_command_notifies_for_expiring_vendor_documents(): void
    {
        $tenant = Tenant::factory()->create();
        $officer = $this->makeProcurementOfficer($tenant);
        $vendor = Vendor::create([
            'tenant_id' => $tenant->id,
            'name' => 'Expiring Docs Ltd',
            'status' => Vendor::STATUS_APPROVED,
            'is_approved' => true,
            'is_active' => true,
        ]);

        SupplierDocument::create([
            'tenant_id' => $tenant->id,
            'vendor_id' => $vendor->id,
            'type_code' => 'tax_clearance',
            'name' => 'Tax clearance',
            'expiry_date' => now()->addDays(10)->toDateString(),
            'status' => SupplierDocument::STATUS_VERIFIED,
            'is_current' => true,
            'version' => 1,
        ]);

        $exit = Artisan::call('procurement:send-document-expiry-reminders');
        $this->assertSame(0, $exit);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $officer->id,
            'trigger' => 'procurement.vendor_document.expiring',
        ]);
    }
}
