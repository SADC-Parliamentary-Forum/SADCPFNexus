<?php

namespace App\Modules\Correspondence\Services;

use App\Models\Correspondence;
use App\Models\CorrespondenceMailboxSetting;
use App\Models\CorrespondenceMailboxSuggestion;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CorrespondenceMailboxService
{
    public function __construct(private readonly CorrespondenceRegisterService $register) {}

    public function getSettings(int $tenantId): CorrespondenceMailboxSetting
    {
        return CorrespondenceMailboxSetting::firstOrCreate(
            ['tenant_id' => $tenantId],
            ['enabled' => false, 'mailbox_address' => null, 'notes' => null],
        );
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateSettings(int $tenantId, array $data, User $user): CorrespondenceMailboxSetting
    {
        $settings = $this->getSettings($tenantId);
        $settings->fill([
            'mailbox_address' => array_key_exists('mailbox_address', $data) ? $data['mailbox_address'] : $settings->mailbox_address,
            'enabled' => array_key_exists('enabled', $data) ? (bool) $data['enabled'] : $settings->enabled,
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $settings->notes,
            'imap_host' => array_key_exists('imap_host', $data) ? $data['imap_host'] : $settings->imap_host,
            'imap_port' => array_key_exists('imap_port', $data) ? $data['imap_port'] : $settings->imap_port,
            'imap_encryption' => array_key_exists('imap_encryption', $data) ? $data['imap_encryption'] : $settings->imap_encryption,
            'imap_username' => array_key_exists('imap_username', $data) ? $data['imap_username'] : $settings->imap_username,
            'updated_by' => $user->id,
        ]);

        if (array_key_exists('imap_password', $data) && filled($data['imap_password'])) {
            $settings->setImapPassword((string) $data['imap_password']);
        }

        $settings->save();

        return $settings->fresh();
    }

    /**
     * @return Collection<int, CorrespondenceMailboxSuggestion>
     */
    public function listSuggestions(int $tenantId, ?string $status = null): Collection
    {
        return CorrespondenceMailboxSuggestion::query()
            ->where('tenant_id', $tenantId)
            ->when($status, fn ($q) => $q->where('status', $status))
            ->orderByDesc('received_at')
            ->orderByDesc('id')
            ->get();
    }

    /**
     * Poll designated registry mailbox (or fixture/messages) into suggestions only.
     * Never auto-registers official correspondence.
     *
     * @param  array{dry_run?: bool, messages?: list<array<string, mixed>>, fixture?: string|null}  $options
     * @return array{status: string, imported: int, skipped: int, dry_run: bool, errors: list<string>}
     */
    public function pollMailbox(int $tenantId, array $options = []): array
    {
        $settings = $this->getSettings($tenantId);
        $dryRun = (bool) ($options['dry_run'] ?? false);

        if (! $settings->enabled) {
            $settings->update(['last_polled_at' => now(), 'last_poll_status' => 'disabled']);

            return ['status' => 'disabled', 'imported' => 0, 'skipped' => 0, 'dry_run' => $dryRun, 'errors' => []];
        }

        $messages = $options['messages'] ?? null;
        if ($messages === null && ! empty($options['fixture'])) {
            $messages = $this->loadFixtureMessages((string) $options['fixture']);
        }

        if ($messages === null) {
            $messages = $this->fetchImapMessages($settings);
        }

        $imported = 0;
        $skipped = 0;
        $errors = [];

        foreach ($messages as $message) {
            try {
                $messageId = $this->normalizeMessageId((string) ($message['message_id'] ?? ''));
                if ($messageId === '') {
                    $skipped++;
                    continue;
                }

                if ($this->messageIdExists($tenantId, $messageId)) {
                    $skipped++;
                    continue;
                }

                if ($dryRun) {
                    $imported++;
                    continue;
                }

                $this->importSuggestion($tenantId, array_merge($message, [
                    'message_id' => $messageId,
                    'raw_headers' => $message['raw_headers'] ?? 'X-Mailbox-Source: registry_imap_poll',
                ]));
                $imported++;
            } catch (\Throwable $e) {
                $skipped++;
                $errors[] = $e->getMessage();
            }
        }

        if (! $dryRun) {
            $settings->update([
                'last_polled_at' => now(),
                'last_poll_status' => empty($errors) ? 'ok' : 'partial',
            ]);
        }

        return [
            'status' => 'ok',
            'imported' => $imported,
            'skipped' => $skipped,
            'dry_run' => $dryRun,
            'errors' => $errors,
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function loadFixtureMessages(string $path): array
    {
        if (! is_file($path)) {
            throw ValidationException::withMessages(['fixture' => ["Fixture not found: {$path}"]]);
        }

        $decoded = json_decode((string) file_get_contents($path), true);
        if (! is_array($decoded)) {
            throw ValidationException::withMessages(['fixture' => ['Fixture must be a JSON array of messages.']]);
        }

        return $decoded;
    }

    /**
     * Fetch UNSEEN messages from the designated registry IMAP mailbox.
     * Requires ext-imap + configured host/username/password.
     *
     * @return list<array<string, mixed>>
     */
    private function fetchImapMessages(CorrespondenceMailboxSetting $settings): array
    {
        $password = $settings->resolveImapPassword();
        if (! filled($settings->imap_host) || ! filled($settings->imap_username) || ! filled($password)) {
            throw ValidationException::withMessages([
                'imap' => ['IMAP is not fully configured. Set host/username and CORRESPONDENCE_IMAP_PASSWORD (or store password), or use --fixture.'],
            ]);
        }

        if (! function_exists('imap_open')) {
            throw ValidationException::withMessages([
                'imap' => ['PHP ext-imap is not available. Use --fixture for tests or install ext-imap for live polling.'],
            ]);
        }

        $encryption = strtolower((string) ($settings->imap_encryption ?: 'ssl'));
        $port = (int) ($settings->imap_port ?: 993);
        $flags = '/imap';
        if ($encryption === 'ssl') {
            $flags .= '/ssl';
        } elseif ($encryption === 'tls') {
            $flags .= '/tls';
        } else {
            $flags .= '/notls';
        }
        $flags .= '/novalidate-cert';

        $mailbox = sprintf('{%s:%d%s}INBOX', $settings->imap_host, $port, $flags);
        $connection = @imap_open($mailbox, (string) $settings->imap_username, (string) $password, 0, 1);
        if ($connection === false) {
            throw ValidationException::withMessages([
                'imap' => ['IMAP connection failed: '.imap_last_error()],
            ]);
        }

        try {
            $emails = imap_search($connection, 'UNSEEN') ?: [];
            $out = [];
            foreach ($emails as $num) {
                $header = imap_headerinfo($connection, $num);
                $messageId = isset($header->message_id) ? trim((string) $header->message_id) : '';
                if ($messageId === '') {
                    $messageId = '<generated-'.md5($settings->tenant_id.'-'.$num.'-'.($header->date ?? microtime(true))).'@sadcpf-nexus>';
                }

                $from = $header->from[0] ?? null;
                $body = imap_fetchbody($connection, $num, '1');
                $preview = is_string($body) ? mb_substr(strip_tags($body), 0, 500) : null;

                $out[] = [
                    'message_id' => $messageId,
                    'subject' => isset($header->subject) ? $this->decodeImapText((string) $header->subject) : null,
                    'from_address' => $from->mailbox && $from->host ? ($from->mailbox.'@'.$from->host) : null,
                    'from_name' => isset($from->personal) ? $this->decodeImapText((string) $from->personal) : null,
                    'received_at' => isset($header->date) ? date('c', strtotime($header->date)) : null,
                    'body_preview' => $preview,
                    'raw_headers' => imap_fetchheader($connection, $num) ?: null,
                ];
            }

            return $out;
        } finally {
            imap_close($connection);
        }
    }

    private function decodeImapText(string $value): string
    {
        $decoded = @imap_mime_header_decode($value);
        if (! is_array($decoded)) {
            return $value;
        }

        return collect($decoded)->map(fn ($part) => $part->text ?? '')->implode('');
    }

    private function messageIdExists(int $tenantId, string $messageId): bool
    {
        $existsSuggestion = CorrespondenceMailboxSuggestion::query()
            ->where('tenant_id', $tenantId)
            ->where('message_id', $messageId)
            ->exists();

        $existsLetter = Correspondence::query()
            ->where('tenant_id', $tenantId)
            ->where('message_id', $messageId)
            ->exists();

        return $existsSuggestion || $existsLetter;
    }

    /**
     * Manual paste / import of a suggested message (suggestion-only; no IMAP auto-submit).
     *
     * @param  array<string, mixed>  $data
     */
    public function importSuggestion(int $tenantId, array $data): CorrespondenceMailboxSuggestion
    {
        $messageId = $this->normalizeMessageId((string) ($data['message_id'] ?? ''));
        if ($messageId === '') {
            throw ValidationException::withMessages(['message_id' => ['Message-ID is required.']]);
        }

        $this->assertMessageIdAvailable($tenantId, $messageId);

        return CorrespondenceMailboxSuggestion::create([
            'tenant_id' => $tenantId,
            'message_id' => $messageId,
            'subject' => $data['subject'] ?? null,
            'from_address' => $data['from_address'] ?? null,
            'from_name' => $data['from_name'] ?? null,
            'received_at' => $data['received_at'] ?? null,
            'body_preview' => $data['body_preview'] ?? null,
            'raw_headers' => $data['raw_headers'] ?? null,
            'status' => 'suggested',
        ]);
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    public function registerFromSuggestion(
        CorrespondenceMailboxSuggestion $suggestion,
        User $user,
        array $extra = [],
    ): Correspondence {
        if ((int) $suggestion->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        if ($suggestion->status !== 'suggested') {
            throw ValidationException::withMessages([
                'status' => ['Only suggested messages can be registered.'],
            ]);
        }

        $this->assertMessageIdAvailable((int) $user->tenant_id, $suggestion->message_id, $suggestion->id);

        return DB::transaction(function () use ($suggestion, $user, $extra) {
            $title = $extra['title'] ?? ($suggestion->subject ?: 'Mailbox suggestion');
            $subject = $extra['subject'] ?? ($suggestion->subject ?: $title);

            $letter = $this->register->registerIncoming($user, array_merge([
                'title' => $title,
                'subject' => $subject,
                'summary' => $extra['summary'] ?? $suggestion->body_preview,
                'body' => $extra['body'] ?? $suggestion->body_preview,
                'channel' => $extra['channel'] ?? 'email',
                'sender_name' => $extra['sender_name'] ?? $suggestion->from_name,
                'sender_organisation' => $extra['sender_organisation'] ?? null,
                'received_at' => $suggestion->received_at?->toDateTimeString() ?? now()->toDateTimeString(),
                'message_id' => $suggestion->message_id,
                'mailbox_source' => 'registry_mailbox_suggestion',
            ], $extra));

            // Persist message_id if registerIncoming does not yet map it.
            if ($letter->message_id !== $suggestion->message_id) {
                $letter->message_id = $suggestion->message_id;
                $letter->mailbox_source = 'registry_mailbox_suggestion';
                $letter->save();
            }

            $suggestion->update([
                'status' => 'imported',
                'correspondence_id' => $letter->id,
                'imported_by' => $user->id,
                'imported_at' => now(),
            ]);

            return $letter->fresh();
        });
    }

    public function dismiss(CorrespondenceMailboxSuggestion $suggestion, User $user): CorrespondenceMailboxSuggestion
    {
        if ((int) $suggestion->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        $suggestion->update(['status' => 'dismissed']);

        return $suggestion->fresh();
    }

    private function normalizeMessageId(string $raw): string
    {
        return trim($raw);
    }

    private function assertMessageIdAvailable(int $tenantId, string $messageId, ?int $ignoreSuggestionId = null): void
    {
        $existsSuggestion = CorrespondenceMailboxSuggestion::query()
            ->where('tenant_id', $tenantId)
            ->where('message_id', $messageId)
            ->when($ignoreSuggestionId, fn ($q) => $q->where('id', '!=', $ignoreSuggestionId))
            ->exists();

        $existsLetter = Correspondence::query()
            ->where('tenant_id', $tenantId)
            ->where('message_id', $messageId)
            ->exists();

        if ($existsSuggestion || $existsLetter) {
            throw ValidationException::withMessages([
                'message_id' => ['This Message-ID is already registered or suggested.'],
            ]);
        }
    }
}
