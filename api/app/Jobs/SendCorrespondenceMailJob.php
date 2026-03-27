<?php

namespace App\Jobs;

use App\Mail\CorrespondenceMail;
use App\Models\Correspondence;
use App\Models\CorrespondenceContact;
use App\Models\CorrespondenceRecipient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
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

    public function handle(): void
    {
        Mail::to($this->contact->email)->send(
            new CorrespondenceMail($this->correspondence, $this->contact, $this->recipientType)
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
