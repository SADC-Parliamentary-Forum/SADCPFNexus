<?php

namespace App\Policies;

use App\Models\Department;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class DepartmentPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $authUser): bool
    {
        return true; // All authenticated users can list departments
    }

    public function view(User $authUser, Department $department): bool
    {
        return $authUser->tenant_id === $department->tenant_id;
    }

    public function create(User $authUser): bool
    {
        return $authUser->isSystemAdmin();
    }

    public function update(User $authUser, Department $department): bool
    {
        return $authUser->isSystemAdmin()
            && $authUser->tenant_id === $department->tenant_id;
    }

    public function delete(User $authUser, Department $department): bool
    {
        return $authUser->isSystemAdmin()
            && $authUser->tenant_id === $department->tenant_id;
    }
}
