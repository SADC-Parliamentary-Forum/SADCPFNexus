<?php

namespace Tests\Unit\Mail;

use App\Mail\ModuleNotificationMail;
use App\Models\User;
use App\Modules\Notifications\Services\SecureLinkService;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * Emails to humans must use the Next.js origin (FRONTEND_URL), not APP_URL
 * (API) and never a leftover localhost default after config:cache.
 *
 * Does not extend Tests\TestCase — no Postgres / RefreshDatabase.
 */
class EmailFrontendUrlTest extends TestCase
{
    private const PROD_WEB = 'https://nexus.sadcpf.org';

    private const PROD_API = 'https://nexus-api.sadcpf.org';

    protected function setUp(): void
    {
        parent::setUp();

        // Simulate config:cache: env() in Blade/services is empty; only config remains.
        foreach (['APP_FRONTEND_URL', 'FRONTEND_URL', 'APP_URL'] as $key) {
            putenv($key);
            unset($_ENV[$key], $_SERVER[$key]);
        }

        config([
            'app.url' => self::PROD_API,
            'app.frontend_url' => self::PROD_WEB,
        ]);
    }

    /**
     * @return array<string, array{0: string}>
     */
    public static function mailViewProvider(): array
    {
        return [
            'notification footer' => ['emails.notification'],
            'weekly summary cta' => ['emails.weekly_summary'],
            'correspondence footer' => ['emails.correspondence'],
        ];
    }

    #[DataProvider('mailViewProvider')]
    public function test_production_frontend_url_appears_in_rendered_mail_and_localhost_does_not(string $view): void
    {
        $html = view($view, $this->viewData($view))->render();

        $this->assertStringContainsString(self::PROD_WEB, $html);
        $this->assertStringNotContainsString('localhost', $html);
        $this->assertStringNotContainsString('127.0.0.1', $html);
        $this->assertStringNotContainsString(self::PROD_API, $html);
    }

    public function test_notification_mailable_footer_and_open_url_use_public_web_origin(): void
    {
        $openUrl = app(SecureLinkService::class)->absoluteSecureUrl('/approvals');
        $html = (new ModuleNotificationMail(
            'Travel awaiting your review',
            'Please sign in to action this request.',
            'Ada Lovelace',
            null,
            null,
            $openUrl,
        ))->render();

        $this->assertStringContainsString(self::PROD_WEB.'/approvals', $html);
        $this->assertStringContainsString(self::PROD_WEB.'/profile/security', $html);
        $this->assertStringNotContainsString('localhost', $html);
        $this->assertStringNotContainsString(self::PROD_API, $html);
    }

    public function test_secure_link_service_prefixes_routes_with_configured_frontend_url(): void
    {
        $url = app(SecureLinkService::class)->absoluteSecureUrl('/travel/12');

        $this->assertSame(self::PROD_WEB.'/travel/12', $url);
        $this->assertStringNotContainsString('localhost', $url);
    }

    public function test_password_reset_email_link_uses_frontend_url_not_api_or_localhost(): void
    {
        $user = new User;
        $user->email = 'ada@example.com';

        $mail = (new ResetPassword('reset-token-example'))->toMail($user);
        $url = $mail->actionUrl;

        $this->assertStringContainsString(self::PROD_WEB.'/reset-password', $url);
        $this->assertStringNotContainsString('localhost', $url);
        $this->assertStringNotContainsString(self::PROD_API, $url);
    }

    public function test_config_app_defines_frontend_url_for_config_cache(): void
    {
        $appConfig = include config_path('app.php');

        $this->assertIsArray($appConfig);
        $this->assertArrayHasKey('frontend_url', $appConfig);
    }

    public function test_dev_frontend_url_may_still_be_localhost(): void
    {
        config([
            'app.url' => 'http://localhost:8000',
            'app.frontend_url' => 'http://localhost:3000',
        ]);

        $html = view('emails.notification', $this->viewData('emails.notification'))->render();

        $this->assertStringContainsString('http://localhost:3000/profile/security', $html);
        $this->assertStringNotContainsString('http://localhost:8000', $html);
    }

    /**
     * @return array<string, mixed>
     */
    private function viewData(string $view): array
    {
        return match ($view) {
            'emails.notification' => [
                'subject' => 'Action required',
                'body' => 'Please review this item in Nexus.',
                'recipientName' => 'Ada Lovelace',
                'openUrl' => self::PROD_WEB.'/approvals',
                'approveUrl' => null,
                'rejectUrl' => null,
            ],
            'emails.weekly_summary' => [
                'user' => (object) ['name' => 'Ada Lovelace'],
                'report' => (object) ['id' => 42],
                'payload' => [
                    'meta' => [
                        'period_start' => '2026-08-10',
                        'period_end' => '2026-08-16',
                        'generated_at' => '2026-08-17T08:00:00Z',
                        'scope' => ['label' => 'Organisation'],
                    ],
                    'highlights' => [],
                    'who_is_out' => [],
                    'personal' => ['timesheet_submitted' => true],
                ],
            ],
            'emails.correspondence' => [
                'correspondence' => (object) [
                    'subject' => 'Note verbale',
                    'title' => 'Note verbale',
                    'body' => 'Please find attached.',
                    'reference_number' => 'NV-1',
                    'sent_at' => now(),
                ],
                'contact' => (object) [
                    'full_name' => 'Ada Lovelace',
                    'organization' => 'SADC-PF',
                ],
                'letterhead' => [
                    'org_name' => 'SADC Parliamentary Forum',
                    'org_abbreviation' => 'SADC-PF',
                ],
            ],
            default => [],
        };
    }
}
