<?php

namespace App\Policies;

use App\Models\HrAppraisalTemplate;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class HrAppraisalTemplatePolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->isSystemAdmin()
            || $user->hasPermissionTo('hr.admin')
            || $user->hasPermissionTo('hr_settings.view')
            || $user->hasPermissionTo('hr_settings.edit');
    }

    public function view(User $user, HrAppraisalTemplate $model): bool
    {
        return $user->tenant_id === $model->tenant_id;
    }

    public function create(User $user): bool
    {
        return $user->isSystemAdmin() || $user->hasPermissionTo('hr_settings.edit');
    }

    public function update(User $user, HrAppraisalTemplate $model): bool
    {
        return ($user->isSystemAdmin() || $user->hasPermissionTo('hr_settings.edit'))
            && $user->tenant_id === $model->tenant_id;
    }

    public function delete(User $user, HrAppraisalTemplate $model): bool
    {
        return ($user->isSystemAdmin() || $user->hasPermissionTo('hr_settings.edit'))
            && $user->tenant_id === $model->tenant_id;
    }
}
