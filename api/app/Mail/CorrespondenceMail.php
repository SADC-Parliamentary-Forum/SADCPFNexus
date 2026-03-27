<?php

namespace App\Mail;

use App\Models\Correspondence;
use App\Models\CorrespondenceContact;
use App\Models\TenantSetting;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class CorrespondenceMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Correspondence $correspondence,
        public readonly CorrespondenceContact $contact,
        public readonly string $recipientType = 'to',
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->correspondence->subject,
        );
    }

    public function content(): Content
    {
        $letterhead = TenantSetting::getLetterheadSettings($this->correspondence->tenant_id);

        return new Content(
            view: 'emails.correspondence',
            with: [
                'correspondence' => $this->correspondence,
                'contact'        => $this->contact,
                'letterhead'     => $letterhead,
            ],
        );
    }

    public function attachments(): array
    {
        if (!$this->correspondence->file_path) {
            return [];
        }

        $fullPath = Storage::disk('local')->path($this->correspondence->file_path);

        if (!file_exists($fullPath)) {
            return [];
        }

        return [
            Attachment::fromPath($fullPath)
                ->as($this->correspondence->original_filename ?? 'correspondence.pdf')
                ->withMime($this->correspondence->mime_type ?? 'application/pdf'),
        ];
    }
}
