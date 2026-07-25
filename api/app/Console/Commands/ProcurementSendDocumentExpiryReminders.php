<?php

namespace App\Console\Commands;

use App\Models\Attachment;
use App\Models\User;
use App\Models\Vendor;
use App\Services\NotificationService;
use Illuminate\Console\Command;

class ProcurementSendDocumentExpiryReminders extends Command
{
    protected $signature = 'procurement:send-document-expiry-reminders';

    protected $description = 'Notify procurement officers of vendor compliance documents that are expired or expiring soon';

    public function handle(NotificationService $notifications): int
    {
        $days = (int) config('procurement.document_expiry_days', 30);
        $horizon = now()->addDays($days)->toDateString();

        $attachments = Attachment::query()
            ->where('attachable_type', Vendor::class)
            ->whereNotNull('expires_at')
            ->whereDate('expires_at', '<=', $horizon)
            ->whereIn('document_type', Attachment::VENDOR_DOCUMENT_TYPES)
            ->with('attachable')
            ->get();

        $sent = 0;
        foreach ($attachments->groupBy('tenant_id') as $tenantId => $docs) {
            $officers = User::query()
                ->where('tenant_id', $tenantId)
                ->whereHas('roles', fn ($q) => $q->whereIn('name', [
                    'Procurement Officer', 'Finance Controller', 'System Admin',
                ]))
                ->get();

            foreach ($docs as $attachment) {
                $vendor = $attachment->attachable;
                if (!$vendor instanceof Vendor) {
                    continue;
                }
                foreach ($officers as $officer) {
                    try {
                        $notifications->dispatch($officer, 'procurement.vendor_document.expiring', [
                            'name'          => $officer->name,
                            'vendor'        => $vendor->name,
                            'document_type' => $attachment->document_type,
                            'expires_at'    => optional($attachment->expires_at)->toDateString(),
                        ], [
                            'module'    => 'procurement',
                            'record_id' => $vendor->id,
                            'url'       => '/procurement/vendors/' . $vendor->id,
                        ], false);
                        $sent++;
                    } catch (\Throwable $e) {
                        report($e);
                    }
                }
            }
        }

        $this->info("Sent {$sent} vendor document expiry reminder(s).");

        return self::SUCCESS;
    }
}
