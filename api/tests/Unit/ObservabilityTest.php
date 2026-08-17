<?php

namespace Tests\Unit;

use App\Support\Observability;
use RuntimeException;
use Tests\TestCase;

class ObservabilityTest extends TestCase
{
    public function test_capture_exception_is_safe_without_sentry_dsn(): void
    {
        config(['services.sentry.dsn' => null]);

        Observability::captureException(new RuntimeException('no sentry in tests'), [
            'request_id' => 'test-request',
        ]);

        $this->assertTrue(true);
    }
}
