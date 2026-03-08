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
        \Log::debug('CORS Request', ['method' => $request->method(), 'url' => $request->fullUrl(), 'origin' => $request->header('Origin')]);

        $origin = $request->header('Origin');
        $allowed = config('cors.allowed_origins');
        if (! is_array($allowed) || empty($allowed)) {
            $allowed = ['http://localhost:3000', 'http://127.0.0.1:3000'];
        }
        $patterns = config('cors.allowed_origins_patterns', []);
        $supportsCredentials = config('cors.supports_credentials', true);

        if ($request->isMethod('OPTIONS')) {
            $originToAllow = $this->resolveOrigin($origin, $allowed, $patterns);
            $headers = [
                'Access-Control-Allow-Origin' => $originToAllow,
                'Access-Control-Allow-Methods' => implode(', ', (array) config('cors.allowed_methods', ['*'])),
                'Access-Control-Allow-Headers' => implode(', ', (array) config('cors.allowed_headers', ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With', 'X-XSRF-TOKEN'])),
                'Access-Control-Max-Age' => (string) config('cors.max_age', 0),
            ];
            if ($supportsCredentials) {
                $headers['Access-Control-Allow-Credentials'] = 'true';
            }
            return response('', 204)->withHeaders($headers);
        }

        $response = $next($request);
        $originToAllow = $this->resolveOrigin($origin, $allowed, $patterns);

        $response->headers->set('Access-Control-Allow-Origin', $originToAllow);
        if ($supportsCredentials) {
            $response->headers->set('Access-Control-Allow-Credentials', 'true');
        }

        return $response;
    }

    /**
     * @param  array<string>  $allowed  Exact origin URLs
     * @param  array<string>  $patterns  Regex patterns (e.g. for localhost with any port)
     */
    private function resolveOrigin(?string $origin, array $allowed, array $patterns = []): string
    {
        if ($origin !== null && $origin !== '') {
            if (in_array($origin, $allowed, true)) {
                return $origin;
            }
            foreach ($patterns as $pattern) {
                if (preg_match($pattern, $origin)) {
                    return $origin;
                }
            }
        }
        return $allowed[0] ?? 'http://localhost:3000';
    }
}
