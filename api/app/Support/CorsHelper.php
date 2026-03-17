<?php

namespace App\Support;

use Illuminate\Http\Request;

/**
 * Builds CORS headers for API responses when the normal HandleCors middleware
 * does not run (e.g. exception handler, explicit OPTIONS fallback).
 * Uses the same config as config/cors.php.
 */
final class CorsHelper
{
    public static function headersForRequest(Request $request): array
    {
        $config = config('cors', []);
        $origin = $request->header('Origin');
        $allowedOrigin = self::resolveAllowedOrigin($origin, $config);
        if ($allowedOrigin === null) {
            $allowed = $config['allowed_origins'] ?? [];
            $allowedOrigin = (is_array($allowed) && $allowed !== []) ? $allowed[0] : 'http://localhost:3000';
        }
        if ($allowedOrigin === '' || $allowedOrigin === null) {
            $allowedOrigin = 'http://localhost:3000';
        }

        $methods = $config['allowed_methods'] ?? ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
        $methodsList = is_array($methods) && in_array('*', $methods, true)
            ? 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
            : implode(', ', $methods);

        $rawHeaders = $config['allowed_headers'] ?? ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With', 'X-XSRF-TOKEN'];
        $supportsCredentials = !empty($config['supports_credentials']) && $config['supports_credentials'];
        // With credentials, browser does not accept Access-Control-Allow-Headers: * — must be an explicit list.
        if ($supportsCredentials && is_array($rawHeaders) && in_array('*', $rawHeaders, true)) {
            $rawHeaders = ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With', 'X-XSRF-TOKEN'];
        }
        $headersList = is_array($rawHeaders) ? implode(', ', $rawHeaders) : (string) $rawHeaders;

        $headers = [
            'Access-Control-Allow-Origin' => $allowedOrigin,
            'Access-Control-Allow-Methods' => $methodsList,
            'Access-Control-Allow-Headers' => $headersList,
            'Access-Control-Max-Age' => (string) ($config['max_age'] ?? 86400),
        ];

        if ($supportsCredentials) {
            $headers['Access-Control-Allow-Credentials'] = 'true';
        }

        return $headers;
    }

    private static function resolveAllowedOrigin(?string $origin, array $config): ?string
    {
        if ($origin === null || $origin === '') {
            return null;
        }
        $allowed = $config['allowed_origins'] ?? [];
        if (is_array($allowed) && (in_array('*', $allowed) || in_array($origin, $allowed, true))) {
            return $origin;
        }
        $patterns = $config['allowed_origins_patterns'] ?? [];
        foreach ($patterns as $pattern) {
            if (is_string($pattern) && preg_match($pattern, $origin)) {
                return $origin;
            }
        }
        // Allow localhost/127.0.0.1 with any port when patterns/config might be wrong
        if (preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#', $origin)) {
            return $origin;
        }
        return null;
    }
}
