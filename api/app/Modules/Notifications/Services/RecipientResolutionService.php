<?php

namespace App\Modules\Notifications\Services;

use App\Models\PeopleAuthority\ActingAppointment;
use App\Models\PeopleAuthority\IdentityDelegation;
use App\Models\PeopleAuthority\PersonUserLink;
use App\Models\User;
use Illuminate\Support\Collection;

class RecipientResolutionService
{
    /**
     * Resolve recipients for a notification instruction (acting/delegation aware).
     *
     * @param  array{user_ids?: int[], users?: iterable, roles?: string[], group_codes?: string[], organisational_unit_ids?: int[], include_acting?: bool, include_delegates?: bool, recipient_role?: string}  $instruction
     * @return list<array{user: User, reason: string, role: ?string}>
     */
    public function resolve(int $tenantId, array $instruction): array
    {
        $resolved = [];
        $seen = [];

        $users = collect($instruction['users'] ?? []);
        foreach (($instruction['user_ids'] ?? []) as $userId) {
            $user = User::query()->where('tenant_id', $tenantId)->find($userId);
            if ($user) {
                $users->push($user);
            }
        }

        foreach ($users as $user) {
            if (! $user instanceof User || isset($seen[$user->id])) {
                continue;
            }
            if (! $this->isEligible($user)) {
                continue;
            }
            $seen[$user->id] = true;
            $resolved[] = [
                'user' => $user,
                'reason' => 'explicit_recipient',
                'role' => $instruction['recipient_role'] ?? null,
            ];

            if ($instruction['include_acting'] ?? true) {
                foreach ($this->actingFor($user) as $actingUser) {
                    if (isset($seen[$actingUser->id]) || ! $this->isEligible($actingUser)) {
                        continue;
                    }
                    $seen[$actingUser->id] = true;
                    $resolved[] = [
                        'user' => $actingUser,
                        'reason' => 'acting_appointment_for_'.$user->id,
                        'role' => 'acting',
                    ];
                }
            }

            if ($instruction['include_delegates'] ?? true) {
                foreach ($this->delegatesFor($user) as $delegate) {
                    if (isset($seen[$delegate->id]) || ! $this->isEligible($delegate)) {
                        continue;
                    }
                    $seen[$delegate->id] = true;
                    $resolved[] = [
                        'user' => $delegate,
                        'reason' => 'identity_delegation_for_'.$user->id,
                        'role' => 'delegate',
                    ];
                }
            }
        }

        $roleNames = array_merge($instruction['roles'] ?? [], $instruction['group_codes'] ?? []);
        foreach ($roleNames as $roleName) {
            try {
                $roleUsers = User::role($roleName)
                    ->where('tenant_id', $tenantId)
                    ->get();
            } catch (\Throwable) {
                $roleUsers = collect();
            }
            foreach ($roleUsers as $user) {
                if (isset($seen[$user->id]) || ! $this->isEligible($user)) {
                    continue;
                }
                $seen[$user->id] = true;
                $resolved[] = [
                    'user' => $user,
                    'reason' => 'group:'.$roleName,
                    'role' => $roleName,
                ];
            }
        }

        // People & Authority organisational units → users via department_id when present.
        foreach (($instruction['organisational_unit_ids'] ?? []) as $ouId) {
            try {
                $ouUsers = User::query()
                    ->where('tenant_id', $tenantId)
                    ->where('department_id', $ouId)
                    ->get();
            } catch (\Throwable) {
                $ouUsers = collect();
            }
            foreach ($ouUsers as $user) {
                if (isset($seen[$user->id]) || ! $this->isEligible($user)) {
                    continue;
                }
                $seen[$user->id] = true;
                $resolved[] = [
                    'user' => $user,
                    'reason' => 'organisational_unit:'.$ouId,
                    'role' => $instruction['recipient_role'] ?? 'ou_member',
                ];
            }
        }

        return $resolved;
    }

    public function isEligible(User $user): bool
    {
        if (isset($user->is_active) && ! $user->is_active) {
            return false;
        }
        if (isset($user->status) && in_array($user->status, ['inactive', 'disabled', 'suspended', 'terminated'], true)) {
            return false;
        }

        return true;
    }

    /** @return Collection<int, User> */
    private function actingFor(User $principal): Collection
    {
        $personId = $this->personIdForUser($principal);
        if (! $personId) {
            return collect();
        }

        try {
            $appointments = ActingAppointment::query()
                ->where('tenant_id', $principal->tenant_id)
                ->where('status', 'active')
                ->where('substantive_person_id', $personId)
                ->where(function ($q) {
                    $q->whereNull('start_at')->orWhere('start_at', '<=', now()->toDateString());
                })
                ->where(function ($q) {
                    $q->whereNull('end_at')->orWhere('end_at', '>=', now()->toDateString());
                })
                ->get();

            return $appointments
                ->map(fn ($appt) => $this->userForPerson((int) $appt->person_id))
                ->filter()
                ->values();
        } catch (\Throwable) {
            return collect();
        }
    }

    /** @return Collection<int, User> */
    private function delegatesFor(User $principal): Collection
    {
        $personId = $this->personIdForUser($principal);
        if (! $personId) {
            return collect();
        }

        try {
            $delegations = IdentityDelegation::query()
                ->where('tenant_id', $principal->tenant_id)
                ->where('status', 'active')
                ->where('principal_person_id', $personId)
                ->where(function ($q) {
                    $q->whereNull('start_at')->orWhere('start_at', '<=', now());
                })
                ->where(function ($q) {
                    $q->whereNull('end_at')->orWhere('end_at', '>=', now());
                })
                ->get();

            return $delegations
                ->map(function ($del) {
                    if ($del->delegate_user_id) {
                        return User::find($del->delegate_user_id);
                    }

                    return $this->userForPerson((int) $del->delegate_person_id);
                })
                ->filter()
                ->values();
        } catch (\Throwable) {
            return collect();
        }
    }

    private function personIdForUser(User $user): ?int
    {
        try {
            $link = PersonUserLink::query()
                ->where('user_id', $user->id)
                ->where('status', 'active')
                ->orderByDesc('id')
                ->first();

            return $link?->person_id ? (int) $link->person_id : null;
        } catch (\Throwable) {
            return null;
        }
    }

    private function userForPerson(int $personId): ?User
    {
        try {
            $link = PersonUserLink::query()
                ->where('person_id', $personId)
                ->where('status', 'active')
                ->orderByDesc('id')
                ->first();

            return $link?->user_id ? User::find($link->user_id) : null;
        } catch (\Throwable) {
            return null;
        }
    }
}
