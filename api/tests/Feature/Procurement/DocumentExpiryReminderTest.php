<?php

namespace Tests\Feature\Procurement;

use App\Models\SupplierDocument;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Vendor;
use App\Modules\Procurement\Services\SupplierComplianceMonitor;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Artisan;
use Mockery;
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

        $keys = [];
        $mock = Mockery::mock(NotificationService::class);
        $mock->shouldReceive('dispatch')->andReturnUsing(function (User $recipient, string $key) use (&$keys) {
            $keys[] = $recipient->id.':'.$key;
        });
        $this->app->forgetInstance(SupplierComplianceMonitor::class);
        $this->app->instance(NotificationService::class, $mock);

        $exit = Artisan::call('procurement:send-document-expiry-reminders');
        $this->assertSame(0, $exit);
        $this->assertContains($officer->id.':procurement.vendor_document.expiring', $keys);
    }
}
