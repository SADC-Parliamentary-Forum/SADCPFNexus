<?php

namespace App\Modules\Correspondence\Services;

use App\Models\Correspondence;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * AI assist for correspondence. NEVER auto-sends — human must confirm before body is applied.
 */
class CorrespondenceAiAssistService
{
    public function generateDraft(Correspondence $letter, User $actor, string $intent = ''): array
    {
        if (! in_array($letter->status, ['draft', 'returned'], true)) {
            throw ValidationException::withMessages(['status' => 'AI assist is only available on editable drafts.']);
        }

        $subject = trim($letter->subject ?: $letter->title ?: 'Official correspondence');
        $intentLine = trim($intent) !== '' ? trim($intent) : 'Prepare a courteous official reply.';

        $draftSubject = $subject;
        if (! str_starts_with(strtolower($draftSubject), 're:')) {
            $draftSubject = 'Re: '.$draftSubject;
        }

        $lines = [];
        $lines[] = 'Dear Colleague,';
        $lines[] = '';
        $lines[] = 'Thank you for your correspondence regarding "'.$subject.'".';
        $lines[] = '';
        $lines[] = $intentLine;
        $lines[] = '';
        $lines[] = 'We will follow up through the official registry channels as required.';
        $lines[] = '';
        $lines[] = 'Yours sincerely,';
        $lines[] = $actor->name;
        $lines[] = '';
        $lines[] = '[Assistant draft — human confirmation required before send. Never auto-sent.]';

        $body = implode("\n", $lines);

        $letter->update([
            'ai_draft_subject' => $draftSubject,
            'ai_draft_body' => $body,
            'ai_draft_confirmed_at' => null,
            'ai_draft_confirmed_by' => null,
        ]);

        return [
            'draft_subject' => $draftSubject,
            'draft_body' => $body,
            'requires_human_confirm' => true,
            'auto_submit' => false,
            'auto_send' => false,
            'confirmed' => false,
        ];
    }

    public function confirm(Correspondence $letter, User $actor): Correspondence
    {
        if (empty($letter->ai_draft_body)) {
            throw ValidationException::withMessages(['ai_draft_body' => 'Generate an AI draft before confirming.']);
        }

        $letter->update([
            'subject' => $letter->ai_draft_subject ?: $letter->subject,
            'title' => $letter->ai_draft_subject ?: $letter->title,
            'body' => $letter->ai_draft_body,
            'ai_draft_confirmed_at' => now(),
            'ai_draft_confirmed_by' => $actor->id,
        ]);

        return $letter->fresh();
    }
}
