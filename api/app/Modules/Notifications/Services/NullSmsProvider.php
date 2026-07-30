<?php

namespace App\Modules\Notifications\Services;

use Illuminate\Support\Facades\Log;

/**
 * Approved SMS / WhatsApp — Null stubs only until governance + credentials.
 * Marked Governance Configuration Pending — never invent API keys or enable live send.
 */
class NullSmsProvider
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
        Log::info('NullSmsProvider suppressed send (governance pending)', [
            'destination_hash' => hash('sha256', $destination),
        ]);

        return [
            'ok' => false,
            'code' => 'sms_governance_pending',
            'summary' => 'SMS delivery not enabled — Governance Configuration Pending',
        ];
    }
}
