<?php

namespace App\Policies;

use App\Models\HrSalaryScale;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class HrSalaryScalePolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->isSystemAdmin()
            || $user->hasPermissionTo('hr.admin')
            || $user->hasPermissionTo('hr_settings.view')
            || $user->hasPermissionTo('hr_settings.edit');
    }

    public function view(User $user, HrSalaryScale $scale): bool
    {
        return $user->tenant_id === $scale->tenant_id;
    }

    public function create(User $user): bool
    {
        return $user->isSystemAdmin() || $user->hasPermissionTo('hr_settings.edit');
    }

    public function update(User $user, HrSalaryScale $scale): bool
    {
        return ($user->isSystemAdmin() || $user->hasPermissionTo('hr_settings.edit'))
            && $user->tenant_id === $scale->tenant_id;
    }

    public function approve(User $user, HrSalaryScale $scale): bool
    {
        return ($user->isSystemAdmin() || $user->hasPermissionTo('hr_settings.approve'))
            && $user->tenant_id === $scale->tenant_id
            && $user->id !== $scale->created_by;
    }

    public function publish(User $user, HrSalaryScale $scale): bool
    {
        return ($user->isSystemAdmin() || $user->hasPermissionTo('hr_settings.publish'))
            && $user->tenant_id === $scale->tenant_id
            && $scale->approved_by !== null;
    }

    public function delete(User $user, HrSalaryScale $scale): bool
    {
        return ($user->isSystemAdmin() || $user->hasPermissionTo('hr_settings.edit'))
            && $user->tenant_id === $scale->tenant_id
            && $scale->status !== 'published';
    }
}
