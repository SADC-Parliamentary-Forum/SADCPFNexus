<?php

namespace App\Modules\PeopleAuthority\Services;

use App\Models\PeopleAuthority\ReportingRelationship;
use Illuminate\Validation\ValidationException;

class ReportingRelationshipService
{
    /**
     * Prevent self-reporting and circular reporting chains among positions.
     */
    public function assertAcyclic(
        int $tenantId,
        int $subordinatePositionId,
        int $supervisorPositionId,
        ?int $ignoreId = null
    ): void {
        if ($subordinatePositionId === $supervisorPositionId) {
            throw ValidationException::withMessages([
                'supervisor_position_id' => ['A position cannot report to itself.'],
            ]);
        }

        // Walk upward from proposed supervisor; if we hit subordinate, cycle exists.
        $visited = [];
        $current = $supervisorPositionId;
        $guard = 0;

        while ($current && $guard < 200) {
            if ($current === $subordinatePositionId) {
                throw ValidationException::withMessages([
                    'supervisor_position_id' => ['This reporting relationship would create a circular chain.'],
                ]);
            }
            if (isset($visited[$current])) {
                break;
            }
            $visited[$current] = true;

            $next = ReportingRelationship::query()
                ->where('tenant_id', $tenantId)
                ->where('subordinate_position_id', $current)
                ->where('status', 'active')
                ->where('is_primary', true)
                ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
                ->where(function ($q) {
                    $q->whereNull('effective_to')->orWhereDate('effective_to', '>=', now()->toDateString());
                })
                ->value('supervisor_position_id');

            $current = $next ? (int) $next : null;
            $guard++;
        }
    }
}
