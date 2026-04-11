<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    protected function redirectTo(Request $request): ?string
    {
        // API routes should never redirect — return null so Laravel throws a
        // clean 401 AuthenticationException instead of trying to resolve the
        // non-existent 'login' named route.
        return null;
    }
}
