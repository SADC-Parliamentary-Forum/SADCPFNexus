<?php

namespace App\Modules\Fleet\Contracts;

use App\Modules\Fleet\Telematics\TelematicsPosition;

interface TelematicsProvider
{
    /**
     * Fetch last-known positions for the given external device ids.
     * Providers may ignore the filter and return all devices; the sync
     * service maps by telematics_device_id and skips unknowns.
     *
     * @param  list<string>  $deviceIds
     * @return list<TelematicsPosition>
     */
    public function fetchPositions(array $deviceIds = []): array;

    /** Driver name reported on synced assets (e.g. generic_http, null). */
    public function name(): string;

    public function isEnabled(): bool;
}
