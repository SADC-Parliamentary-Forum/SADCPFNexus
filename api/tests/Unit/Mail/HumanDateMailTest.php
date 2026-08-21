<?php

namespace Tests\Unit\Mail;

use App\Mail\ModuleNotificationMail;
use App\Modules\Notifications\Services\TemplateService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\TestCase;

/**
 * Email HTML must show SADCPF dates (21 Aug 2026), not ISO dumps.
 * Does not extend Tests\TestCase — no Postgres / RefreshDatabase.
 */
class HumanDateMailTest extends TestCase
{
    public function test_notification_email_renders_interpolated_iso_dates_as_human_dates(): void
    {
        $rendered = app(TemplateService::class)->render(
            [
                'subject' => 'Leave approved',
                'body' => "Your leave from {{start_date}} to {{end_date}} has been approved.\nSubmitted {{submitted_at}}.",
                'privacy_subject' => null,
                'template_version_id' => null,
                'locale' => 'en',
            ],
            [
                'start_date' => '2026-08-21T00:00:00.000000Z',
                'end_date' => '2026-08-25',
                'submitted_at' => '2026-08-21T10:00:00.000000Z',
            ],
        );

        $html = (new ModuleNotificationMail(
            $rendered['subject'],
            $rendered['body'],
            'Ada Lovelace',
            null,
            null,
            'https://nexus.sadcpf.org/leave/1',
        ))->render();

        $this->assertStringContainsString('21 Aug 2026', $html);
        $this->assertStringContainsString('25 Aug 2026', $html);
        $this->assertStringContainsString('21 Aug 2026, 10:00', $html);
        $this->assertStringNotContainsString('2026-08-21T', $html);
        $this->assertStringNotContainsString('000000Z', $html);
    }

    public function test_weekly_summary_email_formats_iso_return_and_generated_dates(): void
    {
        $html = view('emails.weekly_summary', [
            'user' => (object) ['name' => 'Ada Lovelace'],
            'report' => (object) ['id' => 42],
            'payload' => [
                'meta' => [
                    'period_start' => '2026-08-17',
                    'period_end' => '2026-08-21',
                    'generated_at' => '2026-08-21T10:00:00.000000Z',
                    'scope' => ['label' => 'Organisation'],
                ],
                'highlights' => [],
                'who_is_out' => [
                    [
                        'name' => 'Ada Lovelace',
                        'department' => 'HR',
                        'status' => 'Leave',
                        'location' => 'Windhoek',
                        'return_date' => '2026-08-21T00:00:00.000000Z',
                    ],
                ],
                'personal' => ['timesheet_submitted' => true],
            ],
        ])->render();

        $this->assertStringContainsString('21 Aug 2026', $html);
        $this->assertStringContainsString('21 Aug 2026, 10:00', $html);
        $this->assertStringNotContainsString('2026-08-21T', $html);
        $this->assertStringNotContainsString('000000Z', $html);
    }

    public function test_correspondence_email_formats_sent_at_as_human_date(): void
    {
        $html = view('emails.correspondence', [
            'correspondence' => (object) [
                'subject' => 'Note verbale',
                'title' => 'Note verbale',
                'body' => 'Please find attached.',
                'reference_number' => 'NV-1',
                'sent_at' => Carbon::parse('2026-08-21T10:00:00.000000Z'),
            ],
            'contact' => (object) [
                'full_name' => 'Ada Lovelace',
                'organization' => 'SADC-PF',
            ],
            'letterhead' => [
                'org_name' => 'SADC Parliamentary Forum',
                'org_abbreviation' => 'SADC-PF',
            ],
        ])->render();

        $this->assertStringContainsString('21 Aug 2026', $html);
        $this->assertStringNotContainsString('21 August 2026', $html);
        $this->assertStringNotContainsString('2026-08-21T', $html);
        $this->assertStringNotContainsString('000000Z', $html);
    }
}
