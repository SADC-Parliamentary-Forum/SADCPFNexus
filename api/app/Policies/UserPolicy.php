<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class UserPolicy
{
    use HandlesAuthorization;

    /**
     * Any authenticated user can list users (e.g. for PIF responsible officer dropdown).
     * RLS ensures they only see users in their tenant.
     */
    public function viewAny(User $authUser): bool
    {
        return true;
    }

    /**
     * Can view a specific user within the same tenant.
     */
    public function view(User $authUser, User $user): bool
    {
        if ($authUser->id === $user->id) return true;
        return ($authUser->isSystemAdmin() || $authUser->hasAnyRole(['HR Manager']))
            && $authUser->tenant_id === $user->tenant_id;
    }

    /**
     * Only System Admins can create users.
     */
    public function create(User $authUser): bool
    {
        return $authUser->isSystemAdmin();
    }

    /**
     * System Admins can update any user; others can only update themselves.
     */
    public function update(User $authUser, User $user): bool
    {
        if ($authUser->id === $user->id) return true;
        return $authUser->isSystemAdmin() && $authUser->tenant_id === $user->tenant_id;
    }

    /**
     * Only System Admins can deactivate users.
     */
    public function delete(User $authUser, User $user): bool
    {
        if ($authUser->id === $user->id) return false; // Cannot deactivate self
        return $authUser->isSystemAdmin() && $authUser->tenant_id === $user->tenant_id;
    }

    /**
     * Only System Admins can assign roles.
     */
    public function assignRole(User $authUser, User $user): bool
    {
        return $authUser->isSystemAdmin() && $authUser->tenant_id === $user->tenant_id;
    }
}
