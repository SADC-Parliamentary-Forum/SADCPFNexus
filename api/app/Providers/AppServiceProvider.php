<?php

namespace App\Providers;

use App\Models\Department;
use App\Models\HrGradeBand;
use App\Models\HrJobFamily;
use App\Models\HrSalaryScale;
use App\Models\Portfolio;
use App\Models\User;
use App\Policies\DepartmentPolicy;
use App\Policies\HrGradeBandPolicy;
use App\Policies\HrJobFamilyPolicy;
use App\Policies\HrSalaryScalePolicy;
use App\Policies\PortfolioPolicy;
use App\Policies\UserPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::policy(User::class, UserPolicy::class);
        Gate::policy(Department::class, DepartmentPolicy::class);
        Gate::policy(Portfolio::class, PortfolioPolicy::class);
        Gate::policy(HrJobFamily::class, HrJobFamilyPolicy::class);
        Gate::policy(HrGradeBand::class, HrGradeBandPolicy::class);
        Gate::policy(HrSalaryScale::class, HrSalaryScalePolicy::class);
    }
}
