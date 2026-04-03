<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

/**
 * API-only app: never redirect to a login page.
 * Returning null causes Laravel to throw AuthenticationException,
 * which bootstrap/app.php catches and returns a JSON 401.
 */
class Authenticate extends Middleware
{
    protected function redirectTo(Request $request): ?string
    {
        return null;
    }
}
