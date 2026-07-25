<?php

namespace Tests\Feature\Security;

use Tests\TestCase;

class RequestIdMiddlewareTest extends TestCase
{
    public function test_api_response_includes_request_id_header(): void
    {
        $response = $this->getJson('/api/v1/auth/ping');

        $response->assertOk();
        $this->assertNotEmpty($response->headers->get('X-Request-Id'));
    }

    public function test_incoming_request_id_is_echoed(): void
    {
        $id = 'client-req-12345678';

        $response = $this->withHeader('X-Request-Id', $id)
            ->getJson('/api/v1/auth/ping');

        $response->assertOk();
        $this->assertSame($id, $response->headers->get('X-Request-Id'));
    }
}
