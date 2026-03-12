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
            $allowedOrigin = $config['allowed_origins'][0] ?? 'http://localhost:3000';
        }

        $headers = [
            'Access-Control-Allow-Origin' => $allowedOrigin,
            'Access-Control-Allow-Methods' => implode(', ', $config['allowed_methods'] ?? ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']),
            'Access-Control-Allow-Headers' => implode(', ', $config['allowed_headers'] ?? ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With', 'X-XSRF-TOKEN']),
            'Access-Control-Max-Age' => (string) ($config['max_age'] ?? 86400),
        ];

        if (!empty($config['supports_credentials']) && $config['supports_credentials']) {
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
        if (in_array('*', $allowed) || in_array($origin, $allowed, true)) {
            return $origin;
        }
        $patterns = $config['allowed_origins_patterns'] ?? [];
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $origin)) {
                return $origin;
            }
        }
        return null;
    }
}
