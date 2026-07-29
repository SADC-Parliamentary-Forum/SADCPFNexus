<?php

namespace App\Modules\Fleet\Telematics;

use App\Modules\Fleet\Contracts\TelematicsProvider;
use RuntimeException;

/**
 * Reads positions from a local JSON fixture (tests / dry environments).
 */
final class FixtureTelematicsProvider implements TelematicsProvider
{
    public function __construct(private readonly string $path) {}

    public function fetchPositions(array $deviceIds = []): array
    {
        if (! is_readable($this->path)) {
            throw new RuntimeException("Telematics fixture not readable: {$this->path}");
        }

        $decoded = json_decode((string) file_get_contents($this->path), true);
        if (! is_array($decoded)) {
            throw new RuntimeException("Telematics fixture is not valid JSON: {$this->path}");
        }

        $positions = TelematicsJsonParser::parse($decoded);

        if ($deviceIds === []) {
            return $positions;
        }

        $want = array_fill_keys($deviceIds, true);

        return array_values(array_filter(
            $positions,
            fn (TelematicsPosition $p) => isset($want[$p->deviceId])
        ));
    }

    public function name(): string
    {
        return 'fixture';
    }

    public function isEnabled(): bool
    {
        return true;
    }
}
