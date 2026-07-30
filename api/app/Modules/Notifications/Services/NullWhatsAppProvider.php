<?php

namespace App\Modules\Notifications\Services;

use Illuminate\Support\Facades\Log;

/**
 * WhatsApp Business — Null stub only. Live send requires credentials + governance approval.
 */
class NullWhatsAppProvider
{
    public function isEnabled(): bool
    {
        return false;
    }

    public function status(): string
    {
        return 'Governance Configuration Pending';
    }

    /**
     * @return array{ok: bool, code: string, summary: string}
     */
    public function send(string $destination, string $body): array
    {
        Log::info('NullWhatsAppProvider suppressed send (governance pending)', [
            'destination_hash' => hash('sha256', $destination),
        ]);

        return [
            'ok' => false,
            'code' => 'whatsapp_governance_pending',
            'summary' => 'WhatsApp delivery not enabled — Governance Configuration Pending',
        ];
    }
}
