<?php

namespace App\Modules\Notifications\Services;

/**
 * Build authenticated-only Nexus deep links. Never unauthenticated approve/sign/pay.
 */
class SecureLinkService
{
    public function frontendBase(): string
    {
        return rtrim((string) (config('app.frontend_url') ?: env('FRONTEND_URL') ?: env('APP_FRONTEND_URL') ?: ''), '/');
    }

    /**
     * Absolute URL for email CTA — always points at a login-gated route.
     */
    public function absoluteSecureUrl(?string $secureRoute): string
    {
        $route = $this->normalizeRoute($secureRoute);
        $base = $this->frontendBase();

        if ($base === '') {
            return $route;
        }

        return $base.$route;
    }

    public function normalizeRoute(?string $secureRoute): string
    {
        $route = trim((string) $secureRoute);
        if ($route === '') {
            return '/notifications';
        }

        // Reject absolute external URLs from source modules.
        if (preg_match('#^https?://#i', $route)) {
            $path = parse_url($route, PHP_URL_PATH) ?: '/notifications';
            $query = parse_url($route, PHP_URL_QUERY);
            $route = $path.($query ? '?'.$query : '');
        }

        if ($route[0] !== '/') {
            $route = '/'.$route;
        }

        // Block legacy unauthenticated email-action / approval token deep links.
        if (str_contains($route, '/approval?') || str_contains($route, 'email-action') || str_contains($route, 'token=')) {
            return '/approvals';
        }

        return $route;
    }

    /**
     * Strip any unauthenticated action buttons from notification meta.
     */
    public function sanitizeMeta(array $meta): array
    {
        unset($meta['approve_url'], $meta['reject_url'], $meta['sign_url'], $meta['payment_url']);

        if (isset($meta['url'])) {
            $meta['url'] = $this->normalizeRoute((string) $meta['url']);
            $meta['secure_route'] = $meta['url'];
        } elseif (isset($meta['secure_route'])) {
            $meta['secure_route'] = $this->normalizeRoute((string) $meta['secure_route']);
            $meta['url'] = $meta['secure_route'];
        }

        return $meta;
    }
}
