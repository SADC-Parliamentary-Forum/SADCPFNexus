<?php

namespace App\Modules\Procurement\Support;

use App\Modules\Procurement\Contracts\ProcurementInboxAdapter;
use Illuminate\Validation\ValidationException;

/**
 * Used when the designated procurement IMAP mailbox is not fully configured.
 * Host alone is not enough — user and password are required.
 */
final class ImapUnconfiguredAdapter implements ProcurementInboxAdapter
{
    public const METHOD = 'imap_unconfigured';

    public function isConfigured(): bool
    {
        return false;
    }

    public function adapterName(): string
    {
        return self::METHOD;
    }

    public function poll(): never
    {
        throw ValidationException::withMessages([
            'imap' => 'Procurement IMAP mailbox adapter is not configured. Upload remains the live intake path.',
        ]);
    }

    public function fetchMessages(): array
    {
        $this->poll();
    }

    public function statusNote(): string
    {
        return 'IMAP intake adapter is not configured. Upload a PDF or DOCX from Create from Invoice / Quote.';
    }
}
