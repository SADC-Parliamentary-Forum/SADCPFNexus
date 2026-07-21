<?php

namespace Tests\Feature\Readiness;

use App\Models\Tenant;
use App\Models\LeaveBalance;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Tests\TestCase;

class ApiRouteScenarioRunnerTest extends TestCase
{
    private function leavePayload(): array
    {
        return [
            'leave_type' => 'annual',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(12)->toDateString(),
            'reason' => 'Route scenario runner',
        ];
    }

    private function buildPayload(?array $inlinePayload, ?string $template): array
    {
        if ($inlinePayload !== null) {
            return $inlinePayload;
        }

        return match ($template) {
            'leave_create_valid' => $this->leavePayload(),
            default => [],
        };
    }

    private function invoke(?string $auth, string $method, string $path, array $payload = [])
    {
        if ($auth === 'staff') {
            $tenant = Tenant::factory()->create();
            [$http, $user] = $this->asStaff($tenant);
            LeaveBalance::query()->updateOrCreate(
                ['user_id' => $user->id, 'period_year' => (int) date('Y')],
                ['annual_balance_days' => 30, 'lil_hours_available' => 8.0, 'sick_leave_used_days' => 0]
            );
            return $http->json($method, $path, $payload);
        }

        return $this->json($method, $path, $payload);
    }

    public function test_route_driven_api_scenarios_for_leave_module(): void
    {
        $configPath = base_path('../scripts/readiness/data/leave-api-scenarios.json');
        $this->assertFileExists($configPath, 'Scenario file missing: ' . $configPath);

        $config = json_decode((string) file_get_contents($configPath), true, 512, JSON_THROW_ON_ERROR);
        $scenarios = $config['scenarios'] ?? [];
        $this->assertNotEmpty($scenarios, 'No scenarios configured.');

        $routes = collect(Route::getRoutes()->getRoutes())
            ->map(fn ($route) => '/' . ltrim((string) $route->uri(), '/'))
            ->filter(fn (string $uri) => str_starts_with($uri, '/api/v1/leave'))
            ->all();

        foreach ($scenarios as $scenario) {
            $name = (string) ($scenario['name'] ?? 'unnamed');
            $method = strtoupper((string) ($scenario['method'] ?? 'GET'));
            $path = (string) ($scenario['path'] ?? '');
            $auth = $scenario['auth'] ?? null;
            $expected = $scenario['expect'] ?? [];

            $this->assertNotEmpty($path, "Scenario {$name} missing path.");
            $this->assertNotEmpty($expected, "Scenario {$name} missing expected status codes.");

            if (Str::contains($path, '/api/v1/leave/')) {
                $this->assertTrue(count($routes) > 0, 'Leave routes were not loaded.');
            }

            $payload = $this->buildPayload($scenario['payload'] ?? null, $scenario['payload_template'] ?? null);
            try {
                $response = $this->invoke($auth, $method, $path, $payload);
            } catch (\Throwable $e) {
                $this->fail("Scenario {$name} threw exception for {$method} {$path}: {$e->getMessage()}");
            }

            $status = $response->getStatusCode();
            $this->assertContains(
                $status,
                $expected,
                "Scenario {$name} expected [" . implode(',', $expected) . "] but got {$status} for {$method} {$path}"
            );

            $this->assertStringNotContainsStringIgnoringCase('stack trace', $response->getContent(), "Scenario {$name} leaked stack trace");
        }
    }
}
