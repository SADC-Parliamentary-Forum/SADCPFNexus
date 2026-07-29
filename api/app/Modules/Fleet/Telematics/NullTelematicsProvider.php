<?php

namespace App\Modules\Fleet\Telematics;

use App\Modules\Fleet\Contracts\TelematicsProvider;

/**
 * Default / disabled driver — poll and sync are no-ops.
 * Manual GPS stub remains fully usable.
 */
final class NullTelematicsProvider implements TelematicsProvider
{
    public function fetchPositions(array $deviceIds = []): array
    {
        return [];
    }

    public function name(): string
    {
        return 'null';
    }

    public function isEnabled(): bool
    {
        return false;
    }
}
