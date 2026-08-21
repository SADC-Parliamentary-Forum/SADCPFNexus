<?php

namespace App\Mail;

use App\Models\WeeklySummaryReport;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WeeklySummaryMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public readonly WeeklySummaryReport $report)
    {
    }

    public function envelope(): Envelope
    {
        $start = human_date($this->report->period_start);
        $end   = human_date($this->report->period_end);

        return new Envelope(
            subject: "SADCPFNexus Weekly Summary – {$start} to {$end}"
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.weekly_summary',
            with: [
                'report'  => $this->report,
                'payload' => $this->report->payload,
                'user'    => $this->report->user,
            ],
        );
    }
}
