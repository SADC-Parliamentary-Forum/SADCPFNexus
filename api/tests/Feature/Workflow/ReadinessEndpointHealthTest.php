<?php

namespace Tests\Feature\Workflow;

use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class ReadinessEndpointHealthTest extends TestCase
{
    /**
     * Do not wrap the full GET probe in one RefreshDatabase transaction.
     * Hundreds of routes × table locks exhausts Postgres shared memory
     * (SQLSTATE 53200) on GitHub Actions' default lock limits.
     *
     * @var list<string|null>
     */
    protected $connectionsToTransact = [];

    public function test_all_api_v1_get_endpoints_do_not_throw_unhandled_500_when_unauthenticated(): void
    {
        $rows = collect(Route::getRoutes()->getRoutes())
            ->map(fn ($route) => [
                'method' => implode('|', $route->methods()),
                'uri' => $route->uri(),
            ])
            ->all();
        $checked = 0;

        foreach ($rows as $row) {
            $methods = explode('|', (string) ($row['method'] ?? ''));
            if (! in_array('GET', $methods, true)) {
                continue;
            }

            $uri = (string) ($row['uri'] ?? '');
            if (! str_starts_with($uri, 'api/v1/')) {
                continue;
            }
            if (preg_match('/\{[^}]*type[^}]*\}/i', $uri) === 1) {
                continue;
            }
            if (preg_match('/\{[^}]*token[^}]*\}/i', $uri) === 1) {
                continue;
            }
            if (preg_match('/\{[^}]*path[^}]*\}/i', $uri) === 1) {
                continue;
            }

            $path = '/'.preg_replace('/\{[^}]+\}/', '1', $uri);
            try {
                $response = $this->getJson($path);
                $status = $response->getStatusCode();
            } catch (\Throwable $e) {
                $this->fail(sprintf('Unhandled exception on unauthenticated GET %s: %s', $path, $e->getMessage()));
            }

            $this->assertNotEquals(
                500,
                $status,
                sprintf('Unhandled 500 on unauthenticated GET %s', $path)
            );

            $checked++;
        }

        $this->assertGreaterThan(0, $checked, 'No API GET endpoints were checked.');
    }
}
