<?php

namespace App\Modules\Procurement\Support;

use Illuminate\Validation\ValidationException;

/**
 * Procurement mailbox IMAP is not wired. Env host/user/password must not be
 * treated as a live poller. Upload remains the live invoice intake path.
 */
final class ImapUnconfiguredAdapter
{
    public const METHOD = 'imap_unconfigured';

    public function isConfigured(): bool
    {
        return false;
    }

    public function poll(): never
    {
        throw ValidationException::withMessages([
            'imap' => 'Procurement IMAP mailbox adapter is not configured. Upload remains the live intake path.',
        ]);
    }

    public function statusNote(): string
    {
        return 'IMAP intake adapter is not configured. Upload a PDF or DOCX from Create from Invoice / Quote.';
    }
}
