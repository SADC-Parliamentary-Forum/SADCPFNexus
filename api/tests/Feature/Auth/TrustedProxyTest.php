<?php

namespace Tests\Feature\Auth;

use Illuminate\Http\Request;
use Tests\TestCase;

class TrustedProxyTest extends TestCase
{
    public function test_forwarded_client_ip_is_used_behind_the_web_proxy(): void
    {
        $request = Request::create(
            'http://10.20.30.8/api/v1/auth/ping',
            'GET',
            [],
            [],
            [],
            [
                'REMOTE_ADDR' => '10.20.30.8',
                'HTTP_ACCEPT' => 'application/json',
                'HTTP_X_FORWARDED_FOR' => '203.0.113.50',
                'HTTP_X_FORWARDED_PROTO' => 'https',
                'HTTP_X_FORWARDED_HOST' => 'nexus.sadcpf.org',
            ],
        );

        $response = $this->app->handle($request);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('203.0.113.50', $request->ip());
        $this->assertSame('nexus.sadcpf.org', $request->getHost());
        $this->assertTrue($request->isSecure());
    }
}
