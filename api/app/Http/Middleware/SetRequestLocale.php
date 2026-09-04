<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Honour Accept-Language from web and mobile clients (en, fr, pt).
 * UI catalogs remain client-owned; this only localises API chrome messages.
 */
class SetRequestLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        $header = strtolower((string) $request->header('Accept-Language', 'en'));
        $code = substr($header, 0, 2);
        $locale = in_array($code, ['en', 'fr', 'pt'], true) ? $code : 'en';
        app()->setLocale($locale);

        return $next($request);
    }
}
