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
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->notifSubject);
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.notification',
            with: [
                'subject'       => $this->notifSubject,
                'body'          => $this->notifBody,
                'recipientName' => $this->recipientName,
            ],
        );
    }
}
