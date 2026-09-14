<?php

namespace App\Console\Commands;

use App\Modules\Procurement\Services\SupplierComplianceMonitor;
use Illuminate\Console\Command;

class ProcurementSendDocumentExpiryReminders extends Command
{
    protected $signature = 'procurement:send-document-expiry-reminders';

    protected $description = 'Notify suppliers and procurement of expiring or expired compliance documents and flip Compliance Warning';

    public function handle(SupplierComplianceMonitor $monitor): int
    {
        $sent = $monitor->run();
        $this->info("Sent {$sent} supplier document expiry notice(s).");

        return self::SUCCESS;
    }
}
