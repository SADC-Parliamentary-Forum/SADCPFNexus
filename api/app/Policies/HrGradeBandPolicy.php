<?php

namespace App\Policies;

use App\Models\HrGradeBand;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class HrGradeBandPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->isSystemAdmin()
            || $user->hasPermissionTo('hr.admin')
            || $user->hasPermissionTo('hr_settings.view')
            || $user->hasPermissionTo('hr_settings.edit');
    }

    public function view(User $user, HrGradeBand $grade): bool
    {
        return $user->tenant_id === $grade->tenant_id;
    }

    public function create(User $user): bool
    {
        return $user->isSystemAdmin() || $user->hasPermissionTo('hr_settings.edit');
    }

    public function update(User $user, HrGradeBand $grade): bool
    {
        return ($user->isSystemAdmin() || $user->hasPermissionTo('hr_settings.edit'))
            && $user->tenant_id === $grade->tenant_id;
    }

    /** Maker-checker: approver must not be the original creator. */
    public function approve(User $user, HrGradeBand $grade): bool
    {
        return ($user->isSystemAdmin() || $user->hasPermissionTo('hr_settings.approve'))
            && $user->tenant_id === $grade->tenant_id
            && $user->id !== $grade->created_by;
    }

    public function publish(User $user, HrGradeBand $grade): bool
    {
        return ($user->isSystemAdmin() || $user->hasPermissionTo('hr_settings.publish'))
            && $user->tenant_id === $grade->tenant_id
            && $grade->approved_by !== null;
    }

    public function delete(User $user, HrGradeBand $grade): bool
    {
        return ($user->isSystemAdmin() || $user->hasPermissionTo('hr_settings.edit'))
            && $user->tenant_id === $grade->tenant_id
            && $grade->status === 'draft'
            && ! $grade->hasActiveStaff();
    }
}
