<?php

namespace App\Modules\Notifications\Services;

use App\Mail\ModuleNotificationMail;
use App\Models\Notifications\NotificationChannelDelivery;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * Primary/secondary email mailer with automatic failover on temporary failure.
 */
class FailoverMailService
{
    public function primaryMailer(): string
    {
        $configured = config('notifications.email_primary_mailer');

        return (string) ($configured ?: config('mail.default', 'log'));
    }

    public function secondaryMailer(): ?string
    {
        $secondary = config('notifications.email_secondary_mailer');

        return $secondary ? (string) $secondary : null;
    }

    public function failoverEnabled(): bool
    {
        return (bool) config('notifications.email_failover_enabled', true);
    }

    /**
     * @return array{ok: bool, provider: string, failover: bool, temporary: bool, code: string, summary: string, message_id: ?string, duration_ms: int}
     */
    public function send(User $recipient, string $subject, string $body, string $secureUrl, NotificationChannelDelivery $delivery): array
    {
        return $this->sendToAddress(
            (string) $recipient->email,
            (string) ($recipient->name ?? 'Recipient'),
            $subject,
            $body,
            $secureUrl,
            $delivery,
        );
    }

    /**
     * Queue a ModuleNotificationMail to an arbitrary address (external vendor / contact).
     *
     * @return array{ok: bool, provider: string, failover: bool, temporary: bool, code: string, summary: string, message_id: ?string, duration_ms: int}
     */
    public function sendToAddress(
        string $email,
        string $name,
        string $subject,
        string $body,
        ?string $secureUrl,
        NotificationChannelDelivery $delivery,
    ): array {
        $started = microtime(true);
        $primary = $this->primaryMailer();
        $mailable = new ModuleNotificationMail(
            $subject,
            $body,
            $name,
            null,
            null,
            $secureUrl,
        );

        return $this->queueWithFailover($email, $mailable, $delivery, $primary, $started);
    }

    /**
     * Queue an arbitrary Mailable (weekly summary, correspondence) with failover tracking.
     *
     * @return array{ok: bool, provider: string, failover: bool, temporary: bool, code: string, summary: string, message_id: ?string, duration_ms: int}
     */
    public function queueMailable(string $email, \Illuminate\Mail\Mailable $mailable, NotificationChannelDelivery $delivery): array
    {
        $started = microtime(true);
        $primary = $this->primaryMailer();

        return $this->queueWithFailover($email, $mailable, $delivery, $primary, $started);
    }

    /**
     * @return array{ok: bool, provider: string, failover: bool, temporary: bool, code: string, summary: string, message_id: ?string, duration_ms: int}
     */
    private function queueWithFailover(
        string $email,
        \Illuminate\Mail\Mailable $mailable,
        NotificationChannelDelivery $delivery,
        string $primary,
        float $started,
    ): array {
        $mailers = config('mail.mailers', []);
        if (! array_key_exists($primary, $mailers)) {
            return $this->trySecondaryOrFail(
                $email,
                $mailable,
                $delivery,
                $primary,
                new \RuntimeException("Primary mailer [{$primary}] is not configured"),
                $started,
            );
        }

        try {
            Mail::mailer($primary)->to($email)->queue($mailable);

            return [
                'ok' => true,
                'provider' => $primary,
                'failover' => false,
                'temporary' => false,
                'code' => 'queued',
                'summary' => 'Accepted by primary mailer',
                'message_id' => 'mail-'.$primary.'-'.$delivery->id.'-'.((int) $delivery->attempt_count + 1),
                'duration_ms' => (int) ((microtime(true) - $started) * 1000),
            ];
        } catch (\Throwable $primaryError) {
            Log::warning('Primary mailer failed', ['mailer' => $primary, 'error' => $primaryError->getMessage()]);

            return $this->trySecondaryOrFail($email, $mailable, $delivery, $primary, $primaryError, $started);
        }
    }

    private function trySecondaryOrFail(
        string $email,
        \Illuminate\Mail\Mailable $mailable,
        NotificationChannelDelivery $delivery,
        string $primary,
        \Throwable $primaryError,
        float $started,
    ): array {
        $secondary = $this->secondaryMailer();
        $mailers = config('mail.mailers', []);
        if ($this->failoverEnabled() && $secondary && $secondary !== $primary && array_key_exists($secondary, $mailers)) {
            try {
                Mail::mailer($secondary)->to($email)->queue($mailable);

                return [
                    'ok' => true,
                    'provider' => $secondary,
                    'failover' => true,
                    'temporary' => false,
                    'code' => 'failover_queued',
                    'summary' => 'Primary failed; secondary accepted: '.$primaryError->getMessage(),
                    'message_id' => 'mail-'.$secondary.'-failover-'.$delivery->id,
                    'duration_ms' => (int) ((microtime(true) - $started) * 1000),
                ];
            } catch (\Throwable $secondaryError) {
                return [
                    'ok' => false,
                    'provider' => $secondary,
                    'failover' => true,
                    'temporary' => true,
                    'code' => 'provider_error',
                    'summary' => Str::limit('Primary: '.$primaryError->getMessage().' | Secondary: '.$secondaryError->getMessage(), 500),
                    'message_id' => null,
                    'duration_ms' => (int) ((microtime(true) - $started) * 1000),
                ];
            }
        }

        return [
            'ok' => false,
            'provider' => $primary,
            'failover' => false,
            'temporary' => true,
            'code' => 'provider_error',
            'summary' => Str::limit($primaryError->getMessage(), 500),
            'message_id' => null,
            'duration_ms' => (int) ((microtime(true) - $started) * 1000),
        ];
    }
}
