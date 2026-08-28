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
use App\Modules\Documents\Contracts\MalwareScannerInterface;
use App\Modules\Documents\Drivers\MalwareScannerFactory;
use App\Modules\Finance\Contracts\PayrollRecoveryAdapterInterface;
use App\Modules\Finance\Services\PayrollRecoveryAdapterFactory;
use App\Modules\Fleet\Contracts\TelematicsProvider;
use App\Modules\Fleet\Telematics\TelematicsProviderFactory;
use App\Modules\Travel\Contracts\AirlineItineraryParserInterface;
use App\Modules\Travel\Contracts\FxRateFeedInterface;
use App\Modules\Travel\Contracts\GdsProviderInterface;
use App\Modules\Travel\Contracts\HttpFxRateProviderInterface;
use App\Modules\Travel\Services\ConfigurableFxRateFeed;
use App\Modules\Travel\Services\GdsAwareAirlineItineraryParser;
use App\Modules\Travel\Services\GdsProviderFactory;
use App\Modules\Travel\Services\OptionalHttpFxRateProvider;
use App\Modules\Travel\Services\PracticalAirlineItineraryParser;
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
use App\Support\FrontendUrl;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        if (! function_exists('human_date')) {
            require_once app_path('Support/helpers.php');
        }

        // Document Service AV — factory selects null (default), clamav, or http from DOCUMENT_AV_DRIVER.
        $this->app->singleton(MalwareScannerFactory::class);
        $this->app->bind(MalwareScannerInterface::class, function ($app) {
            return $app->make(MalwareScannerFactory::class)->make();
        });

        $this->app->singleton(PayrollRecoveryAdapterFactory::class);

        // Resolve from SALARY_ADVANCE_PAYROLL_DRIVER (default: manual).
        // Unknown / unconfigured vendor drivers fail closed at resolve time.
        $this->app->bind(PayrollRecoveryAdapterInterface::class, function ($app) {
            return $app->make(PayrollRecoveryAdapterFactory::class)->make();
        });

        // Fleet telematics — default null/disabled keeps manual GPS stub usable.
        // API keys / webhook tokens come from env only (never hardcoded).
        $this->app->singleton(TelematicsProviderFactory::class);
        $this->app->bind(TelematicsProvider::class, function ($app) {
            return $app->make(TelematicsProviderFactory::class)->make();
        });

        // Travel Phase 3 — practical local parser + optional GDS-aware wrapper + configurable FX.
        // Null stubs retained for tests that bind them explicitly; no paid GDS/FX keys.
        $this->app->singleton(GdsProviderFactory::class);
        $this->app->bind(GdsProviderInterface::class, function ($app) {
            return $app->make(GdsProviderFactory::class)->make();
        });
        $this->app->bind(PracticalAirlineItineraryParser::class);
        $this->app->bind(AirlineItineraryParserInterface::class, GdsAwareAirlineItineraryParser::class);
        $this->app->bind(HttpFxRateProviderInterface::class, OptionalHttpFxRateProvider::class);
        $this->app->bind(FxRateFeedInterface::class, ConfigurableFxRateFeed::class);

        // Access Control PDP / registry (PRD Roles & Permissions re-engineering).
        $this->app->singleton(\App\Modules\AccessControl\Services\PermissionRegistry::class);
        $this->app->singleton(\App\Modules\AccessControl\Services\AccessCacheInvalidator::class);
        $this->app->singleton(\App\Modules\AccessControl\Services\SegregationOfDutiesService::class);
        $this->app->singleton(\App\Modules\AccessControl\Services\AccessScopeResolver::class);
        $this->app->singleton(\App\Modules\AccessControl\Services\PolicyDecisionPoint::class);
        $this->app->singleton(\App\Modules\AccessControl\Services\NavigationManifestService::class);
        $this->app->singleton(\App\Modules\AccessControl\Services\RoleCatalogueService::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Login throttle: brute-force protection in production, but a plain
        // `throttle:5,1` is keyed per-IP and shared across every user logging
        // in from the same machine. Local dev/e2e flows routinely authenticate
        // 2+ demo users per Playwright run (see web/tests/e2e/global.setup.ts),
        // and re-running the suite a few times in a debugging session was
        // enough to exhaust 5 attempts/min and silently strand the login page
        // behind a "Too Many Attempts" 429 that looked like an unrelated app
        // bug. Keep the strict production limit; widen it for local/testing.
        RateLimiter::for('login', function (Request $request) {
            $perMinute = app()->environment(['local', 'testing']) ? 60 : 5;

            return Limit::perMinute($perMinute)->by($request->ip());
        });

        ResetPassword::createUrlUsing(function (User $user, string $token): string {
            $frontendUrl = FrontendUrl::base();
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

        // Spatie `can:leave.create` middleware does not know dotted aliases.
        // Forward-map a legacy ability to its *primary* canonical replacement
        // only (index 0). Using the full alias list would treat leave.module.view
        // as leave.approve and leak organisation query scopes.
        Gate::before(function ($user, string $ability, array $arguments = []) {
            if (! $user instanceof User || $arguments !== []) {
                return null;
            }

            if ($user->checkPermissionTo($ability)) {
                return true;
            }

            $aliases = config('access_control.legacy_aliases', []);
            $primary = $aliases[$ability][0] ?? null;
            if (is_string($primary) && $user->checkPermissionTo($primary)) {
                return true;
            }

            foreach ($aliases as $legacy => $canonicals) {
                if (in_array($ability, $canonicals, true) && $user->checkPermissionTo($legacy)) {
                    return true;
                }
            }

            return null;
        });
    }
}
