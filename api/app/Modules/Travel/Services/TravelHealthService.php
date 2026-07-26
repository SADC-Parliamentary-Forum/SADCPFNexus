<?php

namespace App\Modules\Travel\Services;

use App\Models\AuditLog;
use App\Models\TravelRequest;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class TravelHealthService
{
    public const HEALTH_FIELDS = [
        'health_vaccination_required',
        'health_vaccination_status',
        'health_prophylaxis_required',
        'health_prophylaxis_status',
        'health_estimated_cost',
        'health_notes',
        'health_cleared_at',
    ];

    public function canViewHealth(User $user, TravelRequest $travel): bool
    {
        if ($user->isSystemAdmin()) {
            return true;
        }
        if ((int) $travel->requester_id === (int) $user->id) {
            return true;
        }
        if ($user->can('travel.health-view') || $user->can('travel.finance-review') || $user->can('travel.admin')
            || $user->can('travel.admin-review')) {
            return true;
        }

        return $user->hasAnyRole([
            'HR Manager', 'HR Administrator', 'Finance Controller',
            'Administration Officer', 'Secretary General', 'Director',
        ]);
    }

    public function canEditHealth(User $user, TravelRequest $travel): bool
    {
        if ($user->isSystemAdmin()) {
            return true;
        }
        if ($user->can('travel.health-view') || $user->can('travel.admin') || $user->can('travel.admin-review')
            || $user->can('hr.edit') || $user->can('hr.admin')) {
            return true;
        }

        return $user->hasAnyRole(['HR Manager', 'HR Administrator', 'Administration Officer']);
    }

    public function update(TravelRequest $travel, array $data, User $user): TravelRequest
    {
        if (! $this->canEditHealth($user, $travel)) {
            abort(403, 'Not authorised to update travel health pack.');
        }

        $allowed = [
            'health_vaccination_required' => ['nullable', 'boolean'],
            'health_vaccination_status' => ['nullable', 'string', 'max:50'],
            'health_prophylaxis_required' => ['nullable', 'boolean'],
            'health_prophylaxis_status' => ['nullable', 'string', 'max:50'],
            'health_estimated_cost' => ['nullable', 'numeric', 'min:0'],
            'health_notes' => ['nullable', 'string', 'max:2000'],
            'health_cleared_at' => ['nullable', 'date'],
        ];

        // Controller already validates; filter keys here.
        $payload = collect($data)->only(array_keys($allowed))->all();
        if ($payload === []) {
            throw ValidationException::withMessages(['health' => 'No health fields provided.']);
        }

        $travel->update($payload);

        AuditLog::record('travel.health_updated', [
            'auditable_type' => TravelRequest::class,
            'auditable_id' => $travel->id,
            'new_values' => $payload,
        ]);

        return $travel->fresh();
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array<string, mixed>
     */
    public function redactForViewer(array $attributes, User $user, TravelRequest $travel): array
    {
        if ($this->canViewHealth($user, $travel)) {
            return $attributes;
        }

        foreach (self::HEALTH_FIELDS as $field) {
            unset($attributes[$field]);
        }

        return $attributes;
    }

    public function hasHealthData(TravelRequest $travel): bool
    {
        return (bool) $travel->health_vaccination_required
            || (bool) $travel->health_prophylaxis_required
            || filled($travel->health_vaccination_status)
            || filled($travel->health_prophylaxis_status)
            || $travel->health_estimated_cost !== null
            || filled($travel->health_notes)
            || $travel->health_cleared_at !== null;
    }
}
