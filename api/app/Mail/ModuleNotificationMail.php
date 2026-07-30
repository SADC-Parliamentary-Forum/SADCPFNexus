<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ModuleNotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $notifSubject,
        public readonly string $notifBody,
        public readonly string $recipientName,
        public readonly ?string $approveUrl = null,
        public readonly ?string $rejectUrl = null,
        public readonly ?string $openUrl = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->notifSubject);
    }

    public function content(): Content
    {
        // Never pass approve/reject into the view — authenticated Open-in-Nexus only (PRD §108).
        $open = $this->openUrl;
        if (! $open && $this->approveUrl) {
            // Legacy callers: strip tokenised approval URLs down to /approvals.
            $open = null;
        }

        return new Content(
            view: 'emails.notification',
            with: [
                'subject' => $this->notifSubject,
                'body' => $this->notifBody,
                'recipientName' => $this->recipientName,
                'approveUrl' => null,
                'rejectUrl' => null,
                'openUrl' => $open,
            ],
        );
    }
}
