<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class UserPolicy
{
    use HandlesAuthorization;

    /**
     * Only System Admins and HR Managers can list users.
     * RLS ensures they only see users in their tenant.
     */
    public function viewAny(User $authUser): bool
    {
        return $authUser->hasAnyRole(['System Admin', 'HR Manager', 'super-admin']);
    }

    /**
     * Can view a specific user within the same tenant.
     */
    public function view(User $authUser, User $user): bool
    {
        if ($authUser->id === $user->id) return true;
        return $authUser->hasAnyRole(['System Admin', 'HR Manager', 'super-admin'])
            && $authUser->tenant_id === $user->tenant_id;
    }

    /**
     * Only System Admins can create users.
     */
    public function create(User $authUser): bool
    {
        return $authUser->hasAnyRole(['System Admin', 'super-admin']);
    }

    /**
     * System Admins can update any user; others can only update themselves.
     */
    public function update(User $authUser, User $user): bool
    {
        if ($authUser->id === $user->id) return true;
        return $authUser->hasAnyRole(['System Admin', 'super-admin'])
            && $authUser->tenant_id === $user->tenant_id;
    }

    /**
     * Only System Admins can deactivate users.
     */
    public function delete(User $authUser, User $user): bool
    {
        if ($authUser->id === $user->id) return false; // Cannot deactivate self
        return $authUser->hasAnyRole(['System Admin', 'super-admin'])
            && $authUser->tenant_id === $user->tenant_id;
    }

    /**
     * Only System Admins can assign roles.
     */
    public function assignRole(User $authUser, User $user): bool
    {
        return $authUser->hasAnyRole(['System Admin', 'super-admin'])
            && $authUser->tenant_id === $user->tenant_id;
    }
}
