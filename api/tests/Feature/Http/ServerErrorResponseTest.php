<?php

namespace Tests\Feature\Http;

use Illuminate\Foundation\Testing\TestCase;
use Illuminate\Support\Facades\Route;
use RuntimeException;

/** Routes without middleware throw before any query, so it skips the base TestCase's database refresh. */
class ServerErrorResponseTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['app.debug' => false]);
    }

    public function test_unexpected_error_hides_its_message(): void
    {
        Route::get('api/v1/__server-error', fn () => throw new RuntimeException('SQLSTATE[08006] host 10.20.30.4 password'));

        $response = $this->getJson('/api/v1/__server-error');

        $response->assertStatus(500)->assertJson(['message' => 'Server error.']);
        $this->assertStringNotContainsString('SQLSTATE', $response->getContent());
        $this->assertStringNotContainsString('10.20.30.4', $response->getContent());
    }

    public function test_deliberate_http_error_keeps_its_message(): void
    {
        Route::get('api/v1/__unavailable', fn () => abort(503, 'Down for maintenance.'));

        $this->getJson('/api/v1/__unavailable')
            ->assertStatus(503)
            ->assertJson(['message' => 'Down for maintenance.']);
    }
}
