<?php

namespace App\Policies;

use App\Models\Portfolio;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class PortfolioPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $authUser): bool
    {
        return true; // All authenticated users can list portfolios
    }

    public function view(User $authUser, Portfolio $portfolio): bool
    {
        return $authUser->tenant_id === $portfolio->tenant_id;
    }

    public function create(User $authUser): bool
    {
        return $authUser->isSystemAdmin();
    }

    public function update(User $authUser, Portfolio $portfolio): bool
    {
        return $authUser->isSystemAdmin()
            && $authUser->tenant_id === $portfolio->tenant_id;
    }

    public function delete(User $authUser, Portfolio $portfolio): bool
    {
        return $authUser->isSystemAdmin()
            && $authUser->tenant_id === $portfolio->tenant_id;
    }
}
