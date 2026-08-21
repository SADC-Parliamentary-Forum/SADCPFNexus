<?php

namespace App\Support;

/**
 * Public Next.js origin for human-facing links (email CTAs, password reset, invitations).
 * Never use APP_URL here — that is the API origin.
 */
final class FrontendUrl
{
    public static function base(): string
    {
        return rtrim((string) config('app.frontend_url'), '/');
    }

    public static function to(string $path = ''): string
    {
        $base = self::base();
        $path = ltrim($path, '/');

        return $path === '' ? $base : $base.'/'.$path;
    }
}
