<?php

namespace Tests\Feature\Procurement;

use App\Models\Attachment;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Vendor;
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
        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'Expiring Docs Ltd', 'is_approved' => true, 'is_active' => true]);

        Attachment::create([
            'tenant_id'         => $tenant->id,
            'uploaded_by'       => $officer->id,
            'attachable_type'   => Vendor::class,
            'attachable_id'     => $vendor->id,
            'document_type'     => Attachment::DOCUMENT_TYPE_TAX_CLEARANCE,
            'original_filename' => 'tax.pdf',
            'storage_path'      => 'attachments/vendors/1/tax.pdf',
            'mime_type'         => 'application/pdf',
            'size_bytes'        => 100,
            'expires_at'        => now()->addDays(10)->toDateString(),
        ]);

        $mock = Mockery::mock(NotificationService::class);
        $mock->shouldReceive('dispatch')
            ->once()
            ->withArgs(function (User $recipient, string $key) use ($officer) {
                return $recipient->id === $officer->id && $key === 'procurement.vendor_document.expiring';
            });
        $this->app->instance(NotificationService::class, $mock);

        $exit = Artisan::call('procurement:send-document-expiry-reminders');
        $this->assertSame(0, $exit);
    }
}
