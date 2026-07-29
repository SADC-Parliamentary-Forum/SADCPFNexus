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
            'mailbox_address' => $data['mailbox_address'] ?? $settings->mailbox_address,
            'enabled' => array_key_exists('enabled', $data) ? (bool) $data['enabled'] : $settings->enabled,
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $settings->notes,
            'updated_by' => $user->id,
        ]);
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
