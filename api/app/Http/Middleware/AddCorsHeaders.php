<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Ensures API responses include CORS headers with a specific origin and credentials support.
 * Required when the frontend uses withCredentials: true (cookies/Authorization).
 * Config from config/cors.php (allowed_origins, supports_credentials).
 */
class AddCorsHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        // Only apply CORS to API routes; skip for web and other paths
        if (! $request->is('api') && ! $request->is('api/*')) {
            return $next($request);
        }

        // Handle preflight (OPTIONS) for API: return 204 with CORS headers immediately
        if ($request->isMethod('OPTIONS')) {
            $headers = \App\Support\CorsHelper::headersForRequest($request);
            return response('', 204)->withHeaders($headers);
        }

        $response = $next($request);

        // Attach CORS headers for all other API responses (including 4xx/5xx).
        foreach (\App\Support\CorsHelper::headersForRequest($request) as $name => $value) {
            $response->headers->set($name, $value);
        }

        return $response;
    }
}
