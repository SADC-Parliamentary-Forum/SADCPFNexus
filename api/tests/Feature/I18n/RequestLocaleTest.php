<?php

namespace Tests\Feature\I18n;

use Tests\TestCase;

class RequestLocaleTest extends TestCase
{
    public function test_unauthenticated_message_follows_accept_language_french(): void
    {
        $response = $this->withHeader('Accept-Language', 'fr')
            ->getJson('/api/v1/auth/me');

        $response->assertUnauthorized();
        $response->assertJson(['message' => 'Non authentifié.']);
    }

    public function test_unauthenticated_message_follows_accept_language_portuguese(): void
    {
        $response = $this->withHeader('Accept-Language', 'pt')
            ->getJson('/api/v1/auth/me');

        $response->assertUnauthorized();
        $response->assertJson(['message' => 'Não autenticado.']);
    }

    public function test_unauthenticated_message_defaults_to_english(): void
    {
        $response = $this->getJson('/api/v1/auth/me');

        $response->assertUnauthorized();
        $response->assertJson(['message' => 'Unauthenticated.']);
    }
}
