<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class CaptchaService
{
    public const HONEYPOT_FIELD = 'website_confirm';

    public function enabled(): bool
    {
        return (bool) config('captcha.enabled');
    }

    public function driver(): string
    {
        if ($this->hasHcaptchaKeys()) {
            return 'hcaptcha';
        }

        if ($this->hasTurnstileKeys()) {
            return 'turnstile';
        }

        return 'challenge';
    }

    public function usesExternalWidget(): bool
    {
        return in_array($this->driver(), ['hcaptcha', 'turnstile'], true);
    }

    /**
     * @return array{enabled: bool, driver: string, site_key: string|null}
     */
    public function publicConfig(): array
    {
        $driver = $this->driver();

        return [
            'enabled'  => $this->enabled(),
            'driver'   => $driver,
            'site_key' => match ($driver) {
                'hcaptcha'  => (string) config('captcha.hcaptcha_site_key'),
                'turnstile' => (string) config('captcha.turnstile_site_key'),
                default     => null,
            },
        ];
    }

    /**
     * @return array{token: string, expires_at: int}
     */
    public function issueChallenge(): array
    {
        $ttl = max(60, (int) config('captcha.ttl_seconds', 600));
        $nonce = bin2hex(random_bytes(16));
        $expiresAt = time() + $ttl;
        $payload = $nonce.'.'.$expiresAt;
        $token = $payload.'.'.$this->sign($payload);

        Cache::put($this->cacheKey($nonce), '1', $ttl);

        return [
            'token'      => $token,
            'expires_at' => $expiresAt,
        ];
    }

    public function assertBrowserSubmission(Request $request, bool $consume = true, bool $allowMobileBypass = true): void
    {
        if ($this->isFilledHoneypot($request)) {
            $this->reject();
        }

        if (! $this->enabled()) {
            return;
        }

        if ($allowMobileBypass && $this->isMobileClient($request)) {
            return;
        }

        $token = trim((string) $request->input('captcha_token', ''));
        if ($token === '') {
            $this->reject();
        }

        if ($this->driver() === 'hcaptcha') {
            $this->assertHcaptcha($token, $request->ip());

            return;
        }

        if ($this->driver() === 'turnstile') {
            $this->assertTurnstile($token, $request->ip());

            return;
        }

        $this->assertChallengeToken($token, $consume);
    }

    public function consumeBrowserChallenge(Request $request): void
    {
        if (! $this->enabled() || $this->isMobileClient($request) || $this->usesExternalWidget()) {
            return;
        }

        $token = trim((string) $request->input('captcha_token', ''));
        if ($token === '') {
            return;
        }

        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return;
        }

        Cache::forget($this->cacheKey($parts[0]));
    }

    public function isMobileClient(Request $request): bool
    {
        return $request->input('client_type') === 'mobile';
    }

    private function hasHcaptchaKeys(): bool
    {
        return trim((string) config('captcha.hcaptcha_secret')) !== ''
            && trim((string) config('captcha.hcaptcha_site_key')) !== '';
    }

    private function hasTurnstileKeys(): bool
    {
        return trim((string) config('captcha.turnstile_secret')) !== ''
            && trim((string) config('captcha.turnstile_site_key')) !== '';
    }

    private function isFilledHoneypot(Request $request): bool
    {
        $value = $request->input(self::HONEYPOT_FIELD);

        return is_string($value) && trim($value) !== '';
    }

    private function assertChallengeToken(string $token, bool $consume): void
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            $this->reject();
        }

        [$nonce, $expiresRaw, $signature] = $parts;
        $payload = $nonce.'.'.$expiresRaw;

        if (! hash_equals($this->sign($payload), $signature)) {
            $this->reject();
        }

        if ((int) $expiresRaw < time()) {
            $this->reject();
        }

        $key = $this->cacheKey($nonce);
        if ($consume) {
            if (! Cache::pull($key)) {
                $this->reject();
            }

            return;
        }

        if (! Cache::has($key)) {
            $this->reject();
        }
    }

    private function assertHcaptcha(string $token, ?string $ip): void
    {
        $response = Http::asForm()
            ->timeout(8)
            ->post('https://api.hcaptcha.com/siteverify', [
                'secret'   => (string) config('captcha.hcaptcha_secret'),
                'response' => $token,
                'remoteip' => $ip,
                'sitekey'  => (string) config('captcha.hcaptcha_site_key'),
            ]);

        if (! $response->ok() || ! ($response->json('success') === true)) {
            $this->reject();
        }
    }

    private function assertTurnstile(string $token, ?string $ip): void
    {
        $secret = (string) config('captcha.turnstile_secret');
        $response = Http::asForm()
            ->timeout(8)
            ->post('https://challenges.cloudflare.com/turnstile/v0/siteverify', [
                'secret'   => $secret,
                'response' => $token,
                'remoteip' => $ip,
            ]);

        if (! $response->ok() || ! ($response->json('success') === true)) {
            $this->reject();
        }
    }

    private function sign(string $payload): string
    {
        return hash_hmac('sha256', $payload, (string) config('app.key'));
    }

    private function cacheKey(string $nonce): string
    {
        return 'captcha:challenge:'.$nonce;
    }

    private function reject(): never
    {
        throw ValidationException::withMessages([
            'captcha_token' => ['Please confirm you are not a robot and try again.'],
        ]);
    }
}
