<?php

namespace App\Providers;

use App\Models\Department;
use App\Models\HrAllowanceProfile;
use App\Models\HrAppraisalTemplate;
use App\Models\HrApprovalMatrix;
use App\Models\HrContractType;
use App\Models\HrGradeBand;
use App\Models\HrJobFamily;
use App\Models\HrLeaveProfile;
use App\Models\HrPersonnelFileSection;
use App\Models\HrSalaryScale;
use App\Models\Portfolio;
use App\Models\User;
use App\Policies\DepartmentPolicy;
use App\Policies\HrAllowanceProfilePolicy;
use App\Policies\HrAppraisalTemplatePolicy;
use App\Policies\HrApprovalMatrixPolicy;
use App\Policies\HrContractTypePolicy;
use App\Policies\HrGradeBandPolicy;
use App\Policies\HrJobFamilyPolicy;
use App\Policies\HrLeaveProfilePolicy;
use App\Policies\HrPersonnelFileSectionPolicy;
use App\Policies\HrSalaryScalePolicy;
use App\Policies\PortfolioPolicy;
use App\Policies\UserPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Auth\Notifications\ResetPassword;

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
        ResetPassword::createUrlUsing(function (User $user, string $token): string {
            $frontendUrl = rtrim((string) env('FRONTEND_URL', config('app.url')), '/');
            $email = urlencode($user->email);
            $encodedToken = urlencode($token);

            return "{$frontendUrl}/reset-password?token={$encodedToken}&email={$email}";
        });

        Gate::policy(User::class, UserPolicy::class);
        Gate::policy(Department::class, DepartmentPolicy::class);
        Gate::policy(Portfolio::class, PortfolioPolicy::class);
        Gate::policy(HrJobFamily::class, HrJobFamilyPolicy::class);
        Gate::policy(HrGradeBand::class, HrGradeBandPolicy::class);
        Gate::policy(HrSalaryScale::class, HrSalaryScalePolicy::class);
        Gate::policy(HrContractType::class, HrContractTypePolicy::class);
        Gate::policy(HrLeaveProfile::class, HrLeaveProfilePolicy::class);
        Gate::policy(HrAllowanceProfile::class, HrAllowanceProfilePolicy::class);
        Gate::policy(HrAppraisalTemplate::class, HrAppraisalTemplatePolicy::class);
        Gate::policy(HrPersonnelFileSection::class, HrPersonnelFileSectionPolicy::class);
        Gate::policy(HrApprovalMatrix::class, HrApprovalMatrixPolicy::class);
    }
}
