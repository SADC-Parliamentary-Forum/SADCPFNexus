<?php

namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\ProcurementInboxMessage;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Procurement\Support\ProcurementInboxFactory;
use App\Support\UploadContentSniffer;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

/**
 * Polls the designated procurement invoice mailbox (or a JSON fixture) into
 * document intakes. Never auto-confirms, never issues an LPO, never pays.
 */
class ProcurementInboxService
{
    private const MAX_ATTACHMENT_BYTES = 25600 * 1024;

    private const ALLOWED_MIMES = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'image/jpeg',
        'image/png',
        'image/webp',
    ];

    public function __construct(
        private readonly ProcurementInboxFactory $factory,
        private readonly DocumentIntakeService $intakes,
    ) {}

    /**
     * @param  array{dry_run?: bool, fixture?: string|null, messages?: list<array<string, mixed>>|null}  $options
     * @return array{status: string, imported: int, skipped: int, dry_run: bool, errors: list<string>}
     */
    public function poll(Tenant $tenant, array $options = []): array
    {
        $dryRun = (bool) ($options['dry_run'] ?? false);
        $errors = [];

        try {
            $messages = $this->loadMessages($tenant, $options);
        } catch (ValidationException $e) {
            return [
                'status' => 'degraded',
                'imported' => 0,
                'skipped' => 0,
                'dry_run' => $dryRun,
                'errors' => array_values(array_map('strval', collect($e->errors())->flatten()->all())),
            ];
        } catch (\Throwable $e) {
            return [
                'status' => 'degraded',
                'imported' => 0,
                'skipped' => 0,
                'dry_run' => $dryRun,
                'errors' => [$e->getMessage()],
            ];
        }

        if ($messages === null) {
            return [
                'status' => 'unconfigured',
                'imported' => 0,
                'skipped' => 0,
                'dry_run' => $dryRun,
                'errors' => [],
            ];
        }

        $actor = $this->actorFor($tenant);
        if (! $actor) {
            return [
                'status' => 'degraded',
                'imported' => 0,
                'skipped' => 0,
                'dry_run' => $dryRun,
                'errors' => ['No Procurement Officer, Finance Controller, System Admin, or Secretary General on this tenant to own inbox intakes.'],
            ];
        }

        $imported = 0;
        $skipped = 0;
        $previous = Auth::user();
        Auth::setUser($actor);

        try {
            foreach ($messages as $message) {
                try {
                    $outcome = $this->ingestMessage($tenant, $actor, $message, $dryRun);
                    if ($outcome === 'imported') {
                        $imported++;
                    } else {
                        $skipped++;
                    }
                } catch (\Throwable $e) {
                    $skipped++;
                    $errors[] = $e->getMessage();
                }
            }
        } finally {
            if ($previous) {
                Auth::setUser($previous);
            } else {
                Auth::forgetUser();
            }
        }

        return [
            'status' => empty($errors) ? 'ok' : 'partial',
            'imported' => $imported,
            'skipped' => $skipped,
            'dry_run' => $dryRun,
            'errors' => $errors,
        ];
    }

    /**
     * @param  array<string, mixed>  $options
     * @return list<array<string, mixed>>|null
     */
    private function loadMessages(Tenant $tenant, array $options): ?array
    {
        if (isset($options['messages']) && is_array($options['messages'])) {
            return array_values($options['messages']);
        }
        if (! empty($options['fixture'])) {
            return $this->loadFixture((string) $options['fixture']);
        }

        $adapter = $this->factory->make((int) $tenant->id);
        if (! $adapter->isConfigured()) {
            return null;
        }

        return $adapter->fetchMessages();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function loadFixture(string $path): array
    {
        if (! is_readable($path)) {
            throw ValidationException::withMessages([
                'fixture' => ["Inbox fixture is not readable: {$path}"],
            ]);
        }
        $decoded = json_decode((string) file_get_contents($path), true);
        if (! is_array($decoded)) {
            throw ValidationException::withMessages([
                'fixture' => ['Inbox fixture must be a JSON array of messages.'],
            ]);
        }

        return array_values($decoded);
    }

    /**
     * @param  array<string, mixed>  $message
     */
    private function ingestMessage(Tenant $tenant, User $actor, array $message, bool $dryRun): string
    {
        $messageId = trim((string) ($message['message_id'] ?? ''));
        if ($messageId !== '' && $this->messageExists($tenant, $messageId)) {
            return 'skipped';
        }

        $fromEmail = strtolower(trim((string) ($message['from_email'] ?? '')));
        if ($fromEmail === '') {
            $fromEmail = 'unknown@invalid';
        }

        if (! $this->senderAllowed($tenant, $fromEmail)) {
            if (! $dryRun) {
                ProcurementInboxMessage::create([
                    'tenant_id' => $tenant->id,
                    'message_id' => $messageId !== '' ? $messageId : null,
                    'from_email' => $fromEmail,
                    'subject' => $message['subject'] ?? null,
                    'received_at' => $this->receivedAt($message),
                    'status' => 'rejected_sender',
                    'payload' => ['reason' => 'sender_not_allowlisted'],
                ]);
            }

            return 'skipped';
        }

        $attachment = $this->firstAllowedAttachment($message['attachments'] ?? []);
        if ($attachment === null) {
            if (! $dryRun && $messageId !== '') {
                ProcurementInboxMessage::create([
                    'tenant_id' => $tenant->id,
                    'message_id' => $messageId,
                    'from_email' => $fromEmail,
                    'subject' => $message['subject'] ?? null,
                    'received_at' => $this->receivedAt($message),
                    'status' => 'skipped_no_attachment',
                    'payload' => ['filenames' => $this->attachmentNames($message['attachments'] ?? [])],
                ]);
            }

            return 'skipped';
        }

        if ($dryRun) {
            return 'imported';
        }

        $file = UploadedFile::fake()->createWithContent($attachment['filename'], $attachment['bytes']);
        $intake = $this->intakes->createFromUpload($actor, $file, null, 'email');

        $row = ProcurementInboxMessage::create([
            'tenant_id' => $tenant->id,
            'message_id' => $messageId !== '' ? $messageId : null,
            'from_email' => $fromEmail,
            'subject' => $message['subject'] ?? null,
            'received_at' => $this->receivedAt($message),
            'status' => 'extracted',
            'intake_id' => $intake->id,
            'payload' => [
                'filename' => $attachment['filename'],
                'mime' => $attachment['mime'],
            ],
        ]);

        AuditLog::record('procurement.document_email_received', [
            'auditable_type' => ProcurementInboxMessage::class,
            'auditable_id' => $row->id,
            'user_id' => $actor->id,
            'tenant_id' => $tenant->id,
            'tags' => 'procurement',
        ]);

        return 'imported';
    }

    private function messageExists(Tenant $tenant, string $messageId): bool
    {
        return ProcurementInboxMessage::query()
            ->where('tenant_id', $tenant->id)
            ->where('message_id', $messageId)
            ->exists();
    }

    private function senderAllowed(Tenant $tenant, string $fromEmail): bool
    {
        $allowlist = $this->allowlist($tenant);
        if ($allowlist === []) {
            return true;
        }

        return in_array($fromEmail, $allowlist, true);
    }

    /**
     * @return list<string>
     */
    private function allowlist(Tenant $tenant): array
    {
        $resolved = \App\Models\TenantMailSetting::resolvedProcurementImap((int) $tenant->id);
        $raw = $resolved['allowlist'] ?? config('procurement.inbox_imap_allowlist');
        if (is_array($raw)) {
            $parts = $raw;
        } else {
            $parts = explode(',', (string) $raw);
        }

        return array_values(array_filter(array_map(
            fn ($value) => strtolower(trim((string) $value)),
            $parts
        )));
    }

    /**
     * @return array{filename: string, mime: string, bytes: string}|null
     */
    private function firstAllowedAttachment(mixed $attachments): ?array
    {
        if (! is_array($attachments)) {
            return null;
        }
        foreach ($attachments as $attachment) {
            if (! is_array($attachment)) {
                continue;
            }
            $filename = (string) ($attachment['filename'] ?? 'attachment.bin');
            $bytes = $this->attachmentBytes($attachment);
            if ($bytes === '' || strlen($bytes) > self::MAX_ATTACHMENT_BYTES) {
                continue;
            }
            $file = UploadedFile::fake()->createWithContent($filename, $bytes);
            try {
                $mime = UploadContentSniffer::assertAllowed($file, self::ALLOWED_MIMES);
            } catch (ValidationException) {
                continue;
            }

            return [
                'filename' => $filename,
                'mime' => $mime,
                'bytes' => $bytes,
            ];
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $attachment
     */
    private function attachmentBytes(array $attachment): string
    {
        if (isset($attachment['bytes']) && is_string($attachment['bytes']) && $attachment['bytes'] !== '') {
            return $attachment['bytes'];
        }
        if (! empty($attachment['base64']) && is_string($attachment['base64'])) {
            $decoded = base64_decode($attachment['base64'], true);

            return is_string($decoded) ? $decoded : '';
        }

        return '';
    }

    /**
     * @return list<string>
     */
    private function attachmentNames(mixed $attachments): array
    {
        if (! is_array($attachments)) {
            return [];
        }

        return array_values(array_filter(array_map(
            fn ($row) => is_array($row) ? (string) ($row['filename'] ?? '') : '',
            $attachments
        )));
    }

    /**
     * @param  array<string, mixed>  $message
     */
    private function receivedAt(array $message): Carbon
    {
        $raw = $message['received_at'] ?? null;
        if (is_string($raw) && $raw !== '') {
            try {
                return Carbon::parse($raw);
            } catch (\Throwable) {
                // fall through
            }
        }

        return now();
    }

    private function actorFor(Tenant $tenant): ?User
    {
        return User::query()
            ->where('tenant_id', $tenant->id)
            ->where('is_active', true)
            ->orderBy('id')
            ->get()
            ->first(fn (User $user) => $user->hasAnyRole([
                'Procurement Officer',
                'Finance Controller',
                'System Admin',
                'Secretary General',
            ]));
    }
}
