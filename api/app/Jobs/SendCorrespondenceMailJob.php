<?php

namespace App\Jobs;

use App\Mail\CorrespondenceMail;
use App\Models\Correspondence;
use App\Models\CorrespondenceContact;
use App\Models\CorrespondenceRecipient;
use App\Services\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class SendCorrespondenceMailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 60;

    public function __construct(
        public readonly Correspondence $correspondence,
        public readonly CorrespondenceContact $contact,
        public readonly string $recipientType = 'to',
    ) {}

    public function handle(NotificationService $notifications): void
    {
        $mailable = new CorrespondenceMail($this->correspondence, $this->contact, $this->recipientType);

        $notifications->dispatchTrackedMailable(
            (int) $this->correspondence->tenant_id,
            'correspondence.outbound_mail',
            (string) $this->contact->email,
            (string) ($this->contact->name ?: $this->contact->email),
            $mailable,
            [
                'module' => 'correspondence',
                'record_id' => $this->correspondence->id,
                'source_type' => Correspondence::class,
                'subject' => $this->correspondence->subject,
                'body' => 'Correspondence letter sent — see email attachment.',
                'idempotency_key' => 'correspondence.outbound:'.$this->correspondence->id.':'.$this->contact->id.':'.$this->recipientType,
            ],
            null,
            null,
            $this->correspondence->subject,
        );

        CorrespondenceRecipient::where('correspondence_id', $this->correspondence->id)
            ->where('contact_id', $this->contact->id)
            ->update([
                'email_sent_at' => now(),
                'email_status'  => 'sent',
            ]);
    }

    public function failed(Throwable $exception): void
    {
        CorrespondenceRecipient::where('correspondence_id', $this->correspondence->id)
            ->where('contact_id', $this->contact->id)
            ->update(['email_status' => 'failed']);
    }
}
