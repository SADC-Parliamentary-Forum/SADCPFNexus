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
        $secret = trim((string) config('captcha.turnstile_secret'));
        $siteKey = trim((string) config('captcha.turnstile_site_key'));

        return ($secret !== '' && $siteKey !== '') ? 'turnstile' : 'challenge';
    }

    /**
     * @return array{enabled: bool, driver: string, site_key: string|null}
     */
    public function publicConfig(): array
    {
        return [
            'enabled'  => $this->enabled(),
            'driver'   => $this->driver(),
            'site_key' => $this->driver() === 'turnstile'
                ? (string) config('captcha.turnstile_site_key')
                : null,
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

        if ($this->driver() === 'turnstile') {
            $this->assertTurnstile($token, $request->ip());

            return;
        }

        $this->assertChallengeToken($token, $consume);
    }

    public function consumeBrowserChallenge(Request $request): void
    {
        if (! $this->enabled() || $this->isMobileClient($request) || $this->driver() === 'turnstile') {
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
