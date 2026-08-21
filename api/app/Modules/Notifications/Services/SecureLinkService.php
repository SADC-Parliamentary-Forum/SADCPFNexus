<?php

namespace App\Modules\Notifications\Services;

/**
 * Build authenticated-only Nexus deep links. Never unauthenticated approve/sign/pay.
 * Phase 2: structured mobile + web deep links (still require auth / session).
 */
class SecureLinkService
{
    public function frontendBase(): string
    {
        return \App\Support\FrontendUrl::base();
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

    /**
     * Mobile deep link (custom scheme) mirroring the authenticated web route.
     * Does not embed approval tokens or unauthenticated action payloads.
     */
    public function mobileDeepLink(?string $secureRoute, array $params = []): string
    {
        $route = ltrim($this->normalizeRoute($secureRoute), '/');
        $scheme = rtrim((string) config('notifications.deep_link_scheme', 'sadcpfnexus'), ':/');
        $query = http_build_query(array_filter($params, fn ($v) => $v !== null && $v !== ''));

        return $scheme.'://'.$route.($query !== '' ? '?'.$query : '');
    }

    /**
     * Structured deep-link payload for push data / inbox clients.
     *
     * @return array{web_path: string, web_url: string, mobile_url: string}
     */
    public function structuredDeepLinks(?string $secureRoute, array $params = []): array
    {
        $path = $this->normalizeRoute($secureRoute);

        return [
            'web_path' => $path,
            'web_url' => $this->absoluteSecureUrl($path),
            'mobile_url' => $this->mobileDeepLink($path, $params),
        ];
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

        // Strip custom-scheme prefixes if present.
        if (preg_match('#^[a-z][a-z0-9+.-]*://#i', $route)) {
            $route = preg_replace('#^[a-z][a-z0-9+.-]*://#i', '/', $route) ?: '/notifications';
        }

        if ($route[0] !== '/') {
            $route = '/'.$route;
        }

        // Block legacy unauthenticated email-action / approval token deep links.
        // External portal tokens use a dedicated public path outside this normaliser.
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

        $links = $this->structuredDeepLinks($meta['secure_route'] ?? $meta['url'] ?? null);
        $meta['web_url'] = $links['web_url'];
        $meta['mobile_url'] = $links['mobile_url'];

        return $meta;
    }
}
