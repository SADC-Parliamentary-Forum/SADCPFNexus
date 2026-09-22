<?php

namespace Tests\Feature\Auth;

use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Tests\TestCase;

class AuthCsrfMismatchTest extends TestCase
{
    public function test_api_csrf_mismatch_returns_friendly_419(): void
    {
        $request = Request::create('/api/v1/auth/login', 'POST');
        $request->headers->set('Accept', 'application/json');

        $response = app(ExceptionHandler::class)->render(
            $request,
            new TokenMismatchException('CSRF token mismatch.')
        );

        $this->assertSame(419, $response->getStatusCode());
        $payload = $response->getData(true);
        $this->assertSame('csrf_mismatch', $payload['code'] ?? null);
        $this->assertArrayHasKey('message', $payload);
        $this->assertStringNotContainsStringIgnoringCase('CSRF token mismatch', $payload['message']);
        $this->assertStringContainsStringIgnoringCase('session', $payload['message']);
    }
}
