<?php

namespace App\Modules\Procurement\Support;

use App\Modules\Procurement\Contracts\ProcurementInboxAdapter;
use Illuminate\Validation\ValidationException;

/**
 * Live IMAP fetch from the designated procurement invoice mailbox only.
 */
final class PhpImapInboxAdapter implements ProcurementInboxAdapter
{
    public const METHOD = 'php_imap';

    public function isConfigured(): bool
    {
        return trim((string) config('procurement.inbox_imap_host')) !== ''
            && trim((string) config('procurement.inbox_imap_user')) !== ''
            && (string) config('procurement.inbox_imap_password') !== '';
    }

    public function adapterName(): string
    {
        return self::METHOD;
    }

    public function statusNote(): string
    {
        return 'The designated procurement mailbox is configured. Unread messages with PDF, Word, or image attachments are ingested for review. They are never auto-confirmed.';
    }

    public function fetchMessages(): array
    {
        if (! $this->isConfigured()) {
            throw ValidationException::withMessages([
                'imap' => ['Procurement IMAP is not fully configured. Set PROCUREMENT_INBOX_IMAP_HOST, USER, and PASSWORD.'],
            ]);
        }
        if (! function_exists('imap_open')) {
            throw ValidationException::withMessages([
                'imap' => ['PHP ext-imap is not available. Use --fixture for tests or install ext-imap in the API image.'],
            ]);
        }

        $host = trim((string) config('procurement.inbox_imap_host'));
        $user = trim((string) config('procurement.inbox_imap_user'));
        $password = (string) config('procurement.inbox_imap_password');
        $port = (int) config('procurement.inbox_imap_port', 993);
        $encryption = strtolower((string) config('procurement.inbox_imap_encryption', 'ssl'));
        $folder = (string) config('procurement.inbox_imap_mailbox', 'INBOX');

        $flags = '/imap';
        if ($encryption === 'ssl') {
            $flags .= '/ssl';
        } elseif ($encryption === 'tls') {
            $flags .= '/tls';
        } else {
            $flags .= '/notls';
        }
        $flags .= '/novalidate-cert';
        $mailbox = sprintf('{%s:%d%s}%s', $host, $port, $flags, $folder);
        $connection = @imap_open($mailbox, $user, $password, 0, 1);
        if ($connection === false) {
            throw ValidationException::withMessages([
                'imap' => ['IMAP connection failed: '.imap_last_error()],
            ]);
        }

        try {
            $emails = imap_search($connection, 'UNSEEN') ?: [];
            $out = [];
            foreach ($emails as $num) {
                $out[] = $this->readMessage($connection, (int) $num);
                @imap_setflag_full($connection, (string) $num, '\\Seen');
            }

            return $out;
        } finally {
            imap_close($connection);
        }
    }

    /**
     * @param  resource  $connection
     * @return array<string, mixed>
     */
    private function readMessage($connection, int $num): array
    {
        $header = imap_headerinfo($connection, $num);
        $messageId = isset($header->message_id) ? trim((string) $header->message_id) : '';
        if ($messageId === '') {
            $messageId = '<generated-'.md5($num.'-'.($header->date ?? microtime(true))).'@sadcpf-nexus>';
        }
        $from = $header->from[0] ?? null;
        $fromEmail = ($from && $from->mailbox && $from->host) ? ($from->mailbox.'@'.$from->host) : '';

        return [
            'message_id' => $messageId,
            'from_email' => $fromEmail,
            'subject' => isset($header->subject) ? $this->decodeHeader((string) $header->subject) : null,
            'received_at' => isset($header->date) ? date('c', strtotime((string) $header->date)) : now()->toIso8601String(),
            'attachments' => $this->attachments($connection, $num),
        ];
    }

    /**
     * @param  resource  $connection
     * @return list<array{filename: string, mime: string, bytes: string}>
     */
    private function attachments($connection, int $num): array
    {
        $structure = imap_fetchstructure($connection, $num);
        if (! $structure) {
            return [];
        }
        $out = [];
        $this->walkParts($connection, $num, $structure, '', $out);

        return $out;
    }

    /**
     * @param  resource  $connection
     * @param  list<array{filename: string, mime: string, bytes: string}>  $out
     */
    private function walkParts($connection, int $num, object $structure, string $prefix, array &$out): void
    {
        $hasParts = ! empty($structure->parts);
        if ($hasParts) {
            foreach ($structure->parts as $i => $part) {
                $partNo = $prefix === '' ? (string) ($i + 1) : $prefix.'.'.($i + 1);
                $this->walkParts($connection, $num, $part, $partNo, $out);
            }

            return;
        }

        $filename = $this->partFilename($structure);
        if ($filename === '' && (int) ($structure->type ?? 0) === 0) {
            return;
        }
        $partNo = $prefix === '' ? '1' : $prefix;
        $raw = imap_fetchbody($connection, $num, $partNo);
        $encoding = (int) ($structure->encoding ?? 0);
        if ($encoding === 3) {
            $raw = base64_decode($raw, true) ?: '';
        } elseif ($encoding === 4) {
            $raw = quoted_printable_decode($raw);
        }
        if ($raw === '' || $filename === '') {
            return;
        }
        $out[] = [
            'filename' => $filename,
            'mime' => $this->partMime($structure),
            'bytes' => $raw,
        ];
    }

    private function partFilename(object $structure): string
    {
        foreach ($structure->dparameters ?? [] as $param) {
            if (strcasecmp((string) $param->attribute, 'filename') === 0) {
                return $this->decodeHeader((string) $param->value);
            }
        }
        foreach ($structure->parameters ?? [] as $param) {
            if (strcasecmp((string) $param->attribute, 'name') === 0) {
                return $this->decodeHeader((string) $param->value);
            }
        }

        return '';
    }

    private function partMime(object $structure): string
    {
        $types = [0 => 'text', 1 => 'multipart', 2 => 'message', 3 => 'application', 4 => 'audio', 5 => 'image', 6 => 'video'];
        $type = $types[(int) ($structure->type ?? 0)] ?? 'application';
        $subtype = strtolower((string) ($structure->subtype ?? 'octet-stream'));

        return $type.'/'.$subtype;
    }

    private function decodeHeader(string $value): string
    {
        $decoded = @imap_mime_header_decode($value);
        if (! is_array($decoded)) {
            return $value;
        }

        return collect($decoded)->map(fn ($part) => $part->text ?? '')->implode('');
    }
}
