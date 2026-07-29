<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Support\CorsHelper;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {

    // Explicit OPTIONS catch-all for CORS preflight (ensures preflight always gets CORS headers)
    Route::options('{path?}', function (Request $request) {
        return response('', 204)->withHeaders(CorsHelper::headersForRequest($request));
    })->where('path', '.*')->name('api.cors.preflight');

    // Public auth routes
    Route::prefix('auth')->group(function () {
        Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
        Route::post('forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
        Route::post('access-request', [AuthController::class, 'accessRequest'])->middleware('throttle:5,1');
        Route::post('reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');
        Route::get('invitations/{token}', [AuthController::class, 'showInvitation'])->middleware('throttle:20,1');
        Route::post('invitations/{token}/activate', [AuthController::class, 'activateInvitation'])->middleware('throttle:5,1');
        // Lightweight connection pre-warm used by the mobile splash screen.
        Route::get('ping', fn () => response()->json(['ok' => true]))->middleware('throttle:60,1');
    });

    // Email action preview — unauthenticated (token is the access control)
    Route::get('email-action/preview/{token}',
        [\App\Http\Controllers\Api\V1\EmailAction\EmailActionController::class, 'preview']
    )->middleware('throttle:20,1');

    // External integration feed — X-External-Token or workplan.external Sanctum
    Route::prefix('external')->group(function () {
        Route::get('workplan', [\App\Http\Controllers\Api\V1\Workplan\WorkplanExternalController::class, 'index'])
            ->middleware([
                'throttle:30,1',
                \App\Http\Middleware\AuthenticateExternalWorkplan::class,
            ]);
    });

    Route::prefix('procurement')->group(function () {
        Route::get('supplier-categories/public', [\App\Http\Controllers\Api\V1\Procurement\SupplierCategoryController::class, 'publicIndex'])
            ->middleware('throttle:60,1');
        Route::post('suppliers/register', [\App\Http\Controllers\Api\V1\Procurement\SupplierRegistrationController::class, 'register'])->middleware('throttle:10,1');
        Route::get('external-rfq/{token}', [\App\Http\Controllers\Api\V1\Procurement\ExternalRfqController::class, 'show'])->middleware('throttle:20,1');
        Route::post('external-rfq/{token}/quote', [\App\Http\Controllers\Api\V1\Procurement\ExternalRfqController::class, 'submit'])->middleware('throttle:20,1');
        Route::get('notices', [\App\Http\Controllers\Api\V1\Procurement\PublicNoticeController::class, 'publicIndex'])
            ->middleware('throttle:60,1');
    });

    // Authenticated routes
    Route::middleware([
        'auth:sanctum',
        \App\Http\Middleware\EnsureSessionAuthIsValid::class,
        'throttle:60,1',
        \App\Http\Middleware\SetRlsContext::class,
    ])->group(function () {

        Route::prefix('auth')->group(function () {
            Route::post('logout', [AuthController::class, 'logout']);
            Route::post('logout-all', [AuthController::class, 'logoutAll']);
            Route::get('me', [AuthController::class, 'me']);
            Route::post('force-reset-password', [AuthController::class, 'forceResetPassword']);
            Route::post('device-token', [AuthController::class, 'registerDeviceToken']);
            Route::delete('device-token', [AuthController::class, 'unregisterDeviceToken']);
        });

        // User Profile (Self-Service)
        Route::get('profile', [\App\Http\Controllers\Api\V1\ProfileController::class, 'show']);
        Route::put('profile', [\App\Http\Controllers\Api\V1\ProfileController::class, 'update']);
        Route::put('profile/password', [\App\Http\Controllers\Api\V1\ProfileController::class, 'updatePassword']);

        // Profile Change Requests (Self-Service Approval Workflow)
        Route::get('profile/change-request', [\App\Http\Controllers\Api\V1\ProfileChangeRequestController::class, 'show']);
        Route::post('profile/change-request', [\App\Http\Controllers\Api\V1\ProfileChangeRequestController::class, 'store']);
        Route::delete('profile/change-request/{changeRequest}', [\App\Http\Controllers\Api\V1\ProfileChangeRequestController::class, 'cancel']);

        // Profile Documents (Self-Service)
        Route::get('profile/documents', [\App\Http\Controllers\Api\V1\ProfileDocumentController::class, 'index']);
        Route::post('profile/documents', [\App\Http\Controllers\Api\V1\ProfileDocumentController::class, 'store']);
        Route::delete('profile/documents/{attachment}', [\App\Http\Controllers\Api\V1\ProfileDocumentController::class, 'destroy']);
        Route::get('profile/documents/{attachment}/download', [\App\Http\Controllers\Api\V1\ProfileDocumentController::class, 'download']);

        // Active Sessions (Self-Service)
        Route::get('profile/sessions', [\App\Http\Controllers\Api\V1\ProfileSessionController::class, 'index']);
        Route::delete('profile/sessions/others', [\App\Http\Controllers\Api\V1\ProfileSessionController::class, 'destroyOthers']);
        Route::delete('profile/sessions/{userSession}', [\App\Http\Controllers\Api\V1\ProfileSessionController::class, 'destroy']);

        // Two-Factor Authentication (TOTP)
        Route::get('profile/2fa/status',   [\App\Http\Controllers\Api\V1\Profile\TwoFactorController::class, 'status']);
        Route::post('profile/2fa/enable',  [\App\Http\Controllers\Api\V1\Profile\TwoFactorController::class, 'enable']);
        Route::post('profile/2fa/confirm', [\App\Http\Controllers\Api\V1\Profile\TwoFactorController::class, 'confirm']);
        Route::post('profile/2fa/disable', [\App\Http\Controllers\Api\V1\Profile\TwoFactorController::class, 'disable']);
        Route::post('profile/2fa/verify',  [\App\Http\Controllers\Api\V1\Profile\TwoFactorController::class, 'verify']);

        // Initial Setup Wizard (self-service, any authenticated user)
        Route::prefix('setup')->group(function () {
            Route::get('options',  [\App\Http\Controllers\Api\V1\SetupController::class, 'options']);
            Route::put('identity', [\App\Http\Controllers\Api\V1\SetupController::class, 'updateIdentity']);
            Route::post('complete',[\App\Http\Controllers\Api\V1\SetupController::class, 'complete']);
        });

        // Email action processing — authenticated (token + user must match)
        Route::post('email-action/process',
            [\App\Http\Controllers\Api\V1\EmailAction\EmailActionController::class, 'process']
        );

        // User Notifications (in-app notification centre)
        Route::prefix('notifications')->group(function () {
            Route::get('/',            [\App\Http\Controllers\Api\V1\Notifications\UserNotificationController::class, 'index']);
            Route::get('/unread-count',[\App\Http\Controllers\Api\V1\Notifications\UserNotificationController::class, 'unreadCount']);
            Route::post('/{id}/read', [\App\Http\Controllers\Api\V1\Notifications\UserNotificationController::class, 'markRead']);
            Route::post('/read-all',  [\App\Http\Controllers\Api\V1\Notifications\UserNotificationController::class, 'markAllRead']);
            Route::delete('/{id}',    [\App\Http\Controllers\Api\V1\Notifications\UserNotificationController::class, 'destroy']);
        });

        Route::get('dashboard/stats', [\App\Http\Controllers\Api\V1\DashboardController::class, 'stats']);
        Route::get('dashboard/upcoming-social', [\App\Http\Controllers\Api\V1\DashboardController::class, 'upcomingSocial']);

        Route::get('lookups', [\App\Http\Controllers\Api\V1\LookupsController::class, 'index']);
        Route::get('tenant-users', [\App\Http\Controllers\Api\V1\TenantUsersController::class, 'index']);

        // Admin SPA: many parallel GETs (user edit loads users, departments, roles, …).
        // The previous throttle:20,1 capped the whole prefix and caused frequent 429s.
        Route::prefix('admin')->middleware('throttle:180,1')->group(function () {
            // Users
            Route::post('users/bulk-deactivate', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'bulkDeactivate']);
            Route::apiResource('users', \App\Http\Controllers\Api\V1\Admin\UsersController::class);
            Route::post('users/{user}/reactivate', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'reactivate']);
            Route::post('users/{user}/change-password', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'changePassword']);
            Route::post('users/{user}/password-reset', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'sendPasswordReset']);
            Route::post('users/{user}/resend-invitation', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'resendInvitation']);
            Route::patch('users/{user}/status', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'updateStatus']);
            Route::patch('users/{user}/roles', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'updateRoles']);
            Route::post('users/{user}/mfa-reset', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'mfaReset']);
            Route::post('users/{user}/revoke-sessions', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'revokeSessions']);
            Route::get('users/{user}/audit', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'audit']);
            Route::get('access-requests', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'accessRequests']);
            Route::post('access-requests/{accessRequest}/approve', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'approveAccessRequest']);
            Route::post('access-requests/{accessRequest}/reject', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'rejectAccessRequest']);

            // Admin: user profile documents
            Route::get('users/{user}/documents', [\App\Http\Controllers\Api\V1\ProfileDocumentController::class, 'adminIndex']);
            Route::post('users/{user}/documents', [\App\Http\Controllers\Api\V1\ProfileDocumentController::class, 'adminStore']);
            Route::delete('users/{user}/documents/{attachment}', [\App\Http\Controllers\Api\V1\ProfileDocumentController::class, 'adminDestroy']);
            Route::get('users/{user}/documents/{attachment}/download', [\App\Http\Controllers\Api\V1\ProfileDocumentController::class, 'adminDownload']);

            // Departments
            Route::apiResource('departments', \App\Http\Controllers\Api\V1\Admin\DepartmentsController::class)
                ->only(['index', 'store', 'update', 'show', 'destroy']);

            // Portfolios
            Route::apiResource('portfolios', \App\Http\Controllers\Api\V1\Admin\PortfoliosController::class);

            // Roles & Permissions (CRUD + assign permissions; assign role to user is via PUT /users/{id})
            Route::get('roles', [\App\Http\Controllers\Api\V1\Admin\RolesController::class, 'index']);
            Route::post('roles', [\App\Http\Controllers\Api\V1\Admin\RolesController::class, 'store']);
            Route::get('roles/{role}', [\App\Http\Controllers\Api\V1\Admin\RolesController::class, 'show']);
            Route::put('roles/{role}', [\App\Http\Controllers\Api\V1\Admin\RolesController::class, 'update']);
            Route::delete('roles/{role}', [\App\Http\Controllers\Api\V1\Admin\RolesController::class, 'destroy']);
            Route::put('roles/{role}/permissions', [\App\Http\Controllers\Api\V1\Admin\RolesController::class, 'syncPermissions']);

            // Payslips (list, show, download, upload, delete, refresh auto-fill)
            Route::get('payslips', [\App\Http\Controllers\Api\V1\Admin\PayslipController::class, 'index']);
            Route::post('payslips', [\App\Http\Controllers\Api\V1\Admin\PayslipController::class, 'store']);
            Route::get('payslips/{payslip}', [\App\Http\Controllers\Api\V1\Admin\PayslipController::class, 'show']);
            Route::get('payslips/{payslip}/download', [\App\Http\Controllers\Api\V1\Admin\PayslipController::class, 'download']);
            Route::post('payslips/{payslip}/refresh', [\App\Http\Controllers\Api\V1\Admin\PayslipController::class, 'refresh']);
            Route::delete('payslips/{payslip}', [\App\Http\Controllers\Api\V1\Admin\PayslipController::class, 'destroy']);

            // Payslip line configs (per-employee)
            Route::get('payslip-configs', [\App\Http\Controllers\Api\V1\Admin\PayslipConfigController::class, 'index']);
            Route::post('payslip-configs/defaults', [\App\Http\Controllers\Api\V1\Admin\PayslipConfigController::class, 'defaults']);
            Route::post('payslip-configs', [\App\Http\Controllers\Api\V1\Admin\PayslipConfigController::class, 'store']);
            Route::put('payslip-configs/{config}', [\App\Http\Controllers\Api\V1\Admin\PayslipConfigController::class, 'update']);
            Route::delete('payslip-configs/{config}', [\App\Http\Controllers\Api\V1\Admin\PayslipConfigController::class, 'destroy']);

            // Employee salary grade/notch assignments
            Route::get('salary-assignments', [\App\Http\Controllers\Api\V1\Admin\EmployeeSalaryAssignmentController::class, 'index']);
            Route::post('salary-assignments', [\App\Http\Controllers\Api\V1\Admin\EmployeeSalaryAssignmentController::class, 'store']);
            Route::put('salary-assignments/{salaryAssignment}', [\App\Http\Controllers\Api\V1\Admin\EmployeeSalaryAssignmentController::class, 'update']);
            Route::delete('salary-assignments/{salaryAssignment}', [\App\Http\Controllers\Api\V1\Admin\EmployeeSalaryAssignmentController::class, 'destroy']);

            // Timesheet projects (admin CRUD)
            Route::get('timesheet-projects', [\App\Http\Controllers\Api\V1\Admin\TimesheetProjectController::class, 'index']);
            Route::post('timesheet-projects', [\App\Http\Controllers\Api\V1\Admin\TimesheetProjectController::class, 'store']);
            Route::put('timesheet-projects/{timesheet_project}', [\App\Http\Controllers\Api\V1\Admin\TimesheetProjectController::class, 'update']);
            Route::delete('timesheet-projects/{timesheet_project}', [\App\Http\Controllers\Api\V1\Admin\TimesheetProjectController::class, 'destroy']);

            // Holiday Calendars (admin CRUD)
            Route::get('holiday-calendars', [\App\Http\Controllers\Api\V1\Admin\HolidayCalendarController::class, 'index']);
            Route::post('holiday-calendars', [\App\Http\Controllers\Api\V1\Admin\HolidayCalendarController::class, 'store']);
            Route::get('holiday-calendars/{holidayCalendar}', [\App\Http\Controllers\Api\V1\Admin\HolidayCalendarController::class, 'show']);
            Route::put('holiday-calendars/{holidayCalendar}', [\App\Http\Controllers\Api\V1\Admin\HolidayCalendarController::class, 'update']);
            Route::delete('holiday-calendars/{holidayCalendar}', [\App\Http\Controllers\Api\V1\Admin\HolidayCalendarController::class, 'destroy']);
            Route::get('holiday-calendars/{holidayCalendar}/dates', [\App\Http\Controllers\Api\V1\Admin\HolidayCalendarController::class, 'listDates']);
            Route::post('holiday-calendars/{holidayCalendar}/dates', [\App\Http\Controllers\Api\V1\Admin\HolidayCalendarController::class, 'bulkUpsertDates']);
            Route::delete('holiday-calendars/{holidayCalendar}/dates/{holidayDate}', [\App\Http\Controllers\Api\V1\Admin\HolidayCalendarController::class, 'destroyDate']);

            // Audit Logs
            Route::get('audit-logs', [\App\Http\Controllers\Api\V1\Admin\AuditLogController::class, 'index']);

            // Ledger Verifications
            Route::get('audit/ledger/verifications', [\App\Http\Controllers\Api\V1\Audit\LedgerVerificationController::class, 'index']);
            Route::post('audit/ledger/verify', [\App\Http\Controllers\Api\V1\Audit\LedgerVerificationController::class, 'store']);
            Route::get('audit/ledger/verifications/{ledgerVerification}', [\App\Http\Controllers\Api\V1\Audit\LedgerVerificationController::class, 'show']);

            // System Settings
            Route::get('settings', [\App\Http\Controllers\Api\V1\Admin\SettingsController::class, 'index']);
            Route::put('settings', [\App\Http\Controllers\Api\V1\Admin\SettingsController::class, 'update']);

            // Notification Templates
            Route::get('notification-templates', [\App\Http\Controllers\Api\V1\Admin\NotificationTemplateController::class, 'index']);
            Route::put('notification-templates', [\App\Http\Controllers\Api\V1\Admin\NotificationTemplateController::class, 'updateByTrigger']);
            Route::post('notification-templates/test-send', [\App\Http\Controllers\Api\V1\Admin\NotificationTemplateController::class, 'testSend']);
            Route::delete('notification-templates', [\App\Http\Controllers\Api\V1\Admin\NotificationTemplateController::class, 'resetToDefault']);

            // Positions (establishment register)
            Route::apiResource('positions', \App\Http\Controllers\Api\V1\Admin\PositionController::class);
            Route::post('positions/{position}/assign', [\App\Http\Controllers\Api\V1\Admin\PositionController::class, 'assign']);

            // HR Settings — Master Data & Rules
            Route::prefix('hr-settings')->group(function () {
                // Job Families
                Route::apiResource('job-families', \App\Http\Controllers\Api\V1\HrSettings\JobFamilyController::class)
                    ->names('hr-settings.job-families');

                // Grade Bands (full lifecycle)
                Route::apiResource('grade-bands', \App\Http\Controllers\Api\V1\HrSettings\GradeBandController::class)
                    ->names('hr-settings.grade-bands');
                Route::post('grade-bands/{gradeBand}/submit',      [\App\Http\Controllers\Api\V1\HrSettings\GradeBandController::class, 'submit'])->name('hr-settings.grade-bands.submit');
                Route::post('grade-bands/{gradeBand}/approve',     [\App\Http\Controllers\Api\V1\HrSettings\GradeBandController::class, 'approve'])->name('hr-settings.grade-bands.approve');
                Route::post('grade-bands/{gradeBand}/publish',     [\App\Http\Controllers\Api\V1\HrSettings\GradeBandController::class, 'publish'])->name('hr-settings.grade-bands.publish');
                Route::post('grade-bands/{gradeBand}/archive',     [\App\Http\Controllers\Api\V1\HrSettings\GradeBandController::class, 'archive'])->name('hr-settings.grade-bands.archive');
                Route::post('grade-bands/{gradeBand}/new-version', [\App\Http\Controllers\Api\V1\HrSettings\GradeBandController::class, 'newVersion'])->name('hr-settings.grade-bands.new-version');
                Route::get( 'grade-bands/{gradeBand}/impact',      [\App\Http\Controllers\Api\V1\HrSettings\GradeBandController::class, 'impactCheck'])->name('hr-settings.grade-bands.impact');

                // Salary Scales (full lifecycle)
                Route::apiResource('salary-scales', \App\Http\Controllers\Api\V1\HrSettings\SalaryScaleController::class)
                    ->names('hr-settings.salary-scales');
                Route::post('salary-scales/{salaryScale}/submit',  [\App\Http\Controllers\Api\V1\HrSettings\SalaryScaleController::class, 'submit'])->name('hr-settings.salary-scales.submit');
                Route::post('salary-scales/{salaryScale}/approve', [\App\Http\Controllers\Api\V1\HrSettings\SalaryScaleController::class, 'approve'])->name('hr-settings.salary-scales.approve');
                Route::post('salary-scales/{salaryScale}/publish', [\App\Http\Controllers\Api\V1\HrSettings\SalaryScaleController::class, 'publish'])->name('hr-settings.salary-scales.publish');

                // Phase 2
                Route::apiResource('contract-types', \App\Http\Controllers\Api\V1\HrSettings\ContractTypeController::class)
                    ->names('hr-settings.contract-types');
                Route::apiResource('leave-profiles', \App\Http\Controllers\Api\V1\HrSettings\LeaveProfileController::class)
                    ->names('hr-settings.leave-profiles');
                Route::apiResource('allowance-profiles', \App\Http\Controllers\Api\V1\HrSettings\AllowanceProfileController::class)
                    ->names('hr-settings.allowance-profiles');

                // Phase 3
                Route::apiResource('appraisal-templates', \App\Http\Controllers\Api\V1\HrSettings\AppraisalTemplateController::class)
                    ->names('hr-settings.appraisal-templates');
                Route::post('personnel-file-sections/reorder', [\App\Http\Controllers\Api\V1\HrSettings\PersonnelFileSectionController::class, 'reorder'])
                    ->name('hr-settings.personnel-file-sections.reorder');
                Route::apiResource('personnel-file-sections', \App\Http\Controllers\Api\V1\HrSettings\PersonnelFileSectionController::class)
                    ->names('hr-settings.personnel-file-sections');
                Route::apiResource('approval-matrix', \App\Http\Controllers\Api\V1\HrSettings\ApprovalMatrixController::class)
                    ->names('hr-settings.approval-matrix');
            });
        });

        // Module routes will be added here per module

        // Travel Module
        Route::prefix('travel')->group(function () {
            Route::get('register/export', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'registerExport']);
            Route::get('dsa-rates', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'dsaRatesIndex']);
            Route::post('dsa-rates', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'dsaRatesStore']);
            Route::get('toil', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'toilIndex']);
            Route::post('toil/{candidate}/authorise-ot', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'toilAuthoriseOt']);
            Route::post('toil/{candidate}/confirm-duty', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'toilConfirmDuty']);
            Route::post('toil/{candidate}/hr-validate', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'toilHrValidate']);
            Route::post('toil/{candidate}/reject', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'toilReject']);
            Route::post('toil/{candidate}/extend', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'toilExtend']);
            Route::get('missions', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'missionsIndex']);
            Route::get('missions/{mission}', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'missionsShow']);
            Route::get('analytics/summary', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'analyticsSummary']);
            Route::get('visa-reminders', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'visaReminders']);
            Route::get('fx-rates', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'fxRatesIndex']);
            Route::post('fx-rates', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'fxRatesStore']);
            Route::get('dashboards/traveller', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'dashboardTraveller']);
            Route::get('dashboards/admin', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'dashboardAdmin']);
            Route::get('dashboards/finance', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'dashboardFinance']);
            Route::get('calendar', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'calendar']);
            Route::get('reports/pack', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'reportsPack']);
            Route::get('reports/pack/export', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'reportsPackExport']);
            Route::get('travellers', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'travellers']);
            Route::get('fleet-vehicles', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'fleetVehicles']);
            Route::get('sponsored-deduction-rates', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'sponsoredRatesIndex']);
            Route::post('sponsored-deduction-rates', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'sponsoredRatesStore']);

            Route::apiResource('requests', \App\Http\Controllers\Api\V1\Travel\TravelController::class)
                ->parameters(['requests' => 'travelRequest'])
                ->names('travel.requests');
            Route::post('requests/{travelRequest}/submit',   [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'submit']);
            Route::post('requests/{travelRequest}/approve',  [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'approve']);
            Route::post('requests/{travelRequest}/reject',   [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'reject']);
            Route::post('requests/{travelRequest}/cancel',   [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'cancel']);
            Route::post('requests/{travelRequest}/return',   [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'returnForCorrection']);
            Route::post('requests/{travelRequest}/withdraw', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'withdraw']);
            Route::post('requests/{travelRequest}/resubmit', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'resubmit']);
            Route::get('requests/{travelRequest}/certificate', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'certificate']);
            Route::get('requests/{travelRequest}/pdf', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'pdf']);
            Route::get('requests/{travelRequest}/travel-pack', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'travelPack']);
            Route::post('requests/{travelRequest}/accommodations', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'storeAccommodation']);
            Route::patch('requests/{travelRequest}/vehicle-mileage', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'updateVehicleMileage']);
            Route::post('requests/{travelRequest}/assign-vehicle', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'assignVehicle']);
            Route::patch('requests/{travelRequest}/personal-days', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'updatePersonalDays']);
            Route::post('requests/{travelRequest}/link-imprest', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'linkImprest']);
            Route::patch('requests/{travelRequest}/visa', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'updateVisa']);
            Route::patch('requests/{travelRequest}/health', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'updateHealth']);
            Route::patch('requests/{travelRequest}/procurement-link', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'updateProcurementLink']);
            Route::post('requests/{travelRequest}/parse-itinerary', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'parseItinerary']);
            Route::post('requests/{travelRequest}/apply-itinerary', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'applyItinerary']);
            Route::post('requests/{travelRequest}/dsa', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'saveDsa']);
            Route::post('requests/{travelRequest}/confirm-funds', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'confirmFunds']);
            Route::post('requests/{travelRequest}/mark-booked', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'markBooked']);
            Route::post('requests/{travelRequest}/mark-returned', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'markReturned']);
            Route::post('requests/{travelRequest}/complete-retirement', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'completeRetirement']);
            Route::post('requests/{travelRequest}/amendments', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'requestAmendment']);
            Route::post('amendments/{amendment}/approve', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'approveAmendment']);
            // Travel attachments
            Route::get('requests/{travelRequest}/attachments',                        [\App\Http\Controllers\Api\V1\Travel\TravelAttachmentController::class, 'index']);
            Route::post('requests/{travelRequest}/attachments',                       [\App\Http\Controllers\Api\V1\Travel\TravelAttachmentController::class, 'store']);
            Route::delete('requests/{travelRequest}/attachments/{attachment}',        [\App\Http\Controllers\Api\V1\Travel\TravelAttachmentController::class, 'destroy']);
            Route::get('requests/{travelRequest}/attachments/{attachment}/download',  [\App\Http\Controllers\Api\V1\Travel\TravelAttachmentController::class, 'download']);
        });

        // Imprest Module
        Route::prefix('imprest')->group(function () {
            Route::apiResource('requests', \App\Http\Controllers\Api\V1\Imprest\ImprestController::class)
                ->parameters(['requests' => 'imprestRequest'])
                ->names('imprest.requests');
            Route::post('requests/{imprestRequest}/submit',   [\App\Http\Controllers\Api\V1\Imprest\ImprestController::class, 'submit']);
            Route::post('requests/{imprestRequest}/approve',  [\App\Http\Controllers\Api\V1\Imprest\ImprestController::class, 'approve']);
            Route::post('requests/{imprestRequest}/reject',   [\App\Http\Controllers\Api\V1\Imprest\ImprestController::class, 'reject']);
            Route::post('requests/{imprestRequest}/return',   [\App\Http\Controllers\Api\V1\Imprest\ImprestController::class, 'returnForCorrection']);
            Route::post('requests/{imprestRequest}/withdraw', [\App\Http\Controllers\Api\V1\Imprest\ImprestController::class, 'withdraw']);
            Route::post('requests/{imprestRequest}/resubmit', [\App\Http\Controllers\Api\V1\Imprest\ImprestController::class, 'resubmit']);
            Route::post('requests/{imprestRequest}/retire',   [\App\Http\Controllers\Api\V1\Imprest\ImprestController::class, 'retire']);
            Route::get('requests/{imprestRequest}/certificate', [\App\Http\Controllers\Api\V1\Imprest\ImprestController::class, 'certificate']);
        });

        // Leave Module
        Route::pattern('leaveRequest', '[0-9]+');
        Route::prefix('leave')->group(function () {
            Route::get('types', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'types']);
            Route::post('preview', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'preview']);
            Route::get('balances', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'balances']);
            // HR Admin: all-staff leave balance management
            Route::get('admin/balances', [\App\Http\Controllers\Api\V1\Hr\AdminLeaveBalancesController::class, 'index']);
            Route::post('admin/balances/initialize-year', [\App\Http\Controllers\Api\V1\Hr\AdminLeaveBalancesController::class, 'initializeYear']);
            Route::post('admin/balances/upsert', [\App\Http\Controllers\Api\V1\Hr\AdminLeaveBalancesController::class, 'upsert']);
            Route::get('lil-accruals', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'lilAccruals']);
            Route::get('toil', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'toil']);
            Route::post('toil/{toilCredit}/extend', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'extendToil']);
            Route::get('team-calendar', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'teamCalendar']);
            Route::get('register/export', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'registerExport']);
            Route::get('requests/{badLeaveRequest}', fn () => abort(404))->where('badLeaveRequest', '[^0-9]+');
            Route::apiResource('requests', \App\Http\Controllers\Api\V1\Leave\LeaveController::class)
                ->parameters(['requests' => 'leaveRequest'])
                ->names('leave.requests');
            Route::post('requests/{leaveRequest}/submit',   [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'submit']);
            Route::post('requests/{leaveRequest}/recommend', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'recommend']);
            Route::post('requests/{leaveRequest}/certify',   [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'certify']);
            Route::post('requests/{leaveRequest}/approve',  [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'approve']);
            Route::post('requests/{leaveRequest}/reject',   [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'reject']);
            Route::post('requests/{leaveRequest}/return',   [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'returnForCorrection']);
            Route::post('requests/{leaveRequest}/withdraw', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'withdraw']);
            Route::post('requests/{leaveRequest}/resubmit', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'resubmit']);
            Route::get('requests/{leaveRequest}/certificate', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'certificate']);
            Route::get('requests/{leaveRequest}/pdf', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'pdf']);
            // Leave attachments
            Route::get('requests/{leaveRequest}/attachments',                       [\App\Http\Controllers\Api\V1\Leave\LeaveAttachmentController::class, 'index']);
            Route::post('requests/{leaveRequest}/attachments',                      [\App\Http\Controllers\Api\V1\Leave\LeaveAttachmentController::class, 'store']);
            Route::delete('requests/{leaveRequest}/attachments/{attachment}',       [\App\Http\Controllers\Api\V1\Leave\LeaveAttachmentController::class, 'destroy']);
            Route::get('requests/{leaveRequest}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Leave\LeaveAttachmentController::class, 'download']);
        });

        // Procurement Module
        Route::prefix('procurement')->group(function () {
            Route::apiResource('requests', \App\Http\Controllers\Api\V1\Procurement\ProcurementController::class)
                ->parameters(['requests' => 'procurementRequest'])
                ->names('procurement.requests');
            Route::post('requests/{procurementRequest}/submit',     [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'submit']);
            Route::post('requests/{procurementRequest}/authorise-split', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'authoriseSplit']);
            Route::post('requests/{procurementRequest}/coi-declarations', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'storeCoiDeclaration']);
            Route::post('requests/{procurementRequest}/hod-approve', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'hodApprove']);
            Route::post('requests/{procurementRequest}/hod-reject',  [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'hodReject']);
            Route::post('requests/{procurementRequest}/approve',     [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'approve']);
            Route::post('requests/{procurementRequest}/reject',      [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'reject']);
            Route::post('requests/{procurementRequest}/return',      [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'returnForCorrection']);
            Route::post('requests/{procurementRequest}/withdraw',    [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'withdraw']);
            Route::post('requests/{procurementRequest}/resubmit',    [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'resubmit']);
            Route::get('requests/{procurementRequest}/certificate',  [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'certificate']);
            Route::post('requests/{procurementRequest}/award',       [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'award']);
            Route::post('requests/{procurementRequest}/issue-rfq',  [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'issueRfq']);
            Route::post('requests/{procurementRequest}/set-method', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'setMethod']);
            Route::post('requests/{procurementRequest}/reserve-budget', [\App\Http\Controllers\Api\V1\Procurement\BudgetReservationController::class, 'store']);
            Route::get('settings', [\App\Http\Controllers\Api\V1\Procurement\ProcurementSettingsController::class, 'show']);
            Route::put('settings', [\App\Http\Controllers\Api\V1\Procurement\ProcurementSettingsController::class, 'update']);

            // Quotes (per request)
            Route::get('requests/{procurementRequest}/quotes',            [\App\Http\Controllers\Api\V1\Procurement\QuoteController::class, 'index']);
            Route::post('requests/{procurementRequest}/quotes',           [\App\Http\Controllers\Api\V1\Procurement\QuoteController::class, 'store']);
            Route::put('requests/{procurementRequest}/quotes/{quote}',    [\App\Http\Controllers\Api\V1\Procurement\QuoteController::class, 'update']);
            Route::post('requests/{procurementRequest}/quotes/{quote}/assess', [\App\Http\Controllers\Api\V1\Procurement\QuoteController::class, 'assess']);
            Route::delete('requests/{procurementRequest}/quotes/{quote}', [\App\Http\Controllers\Api\V1\Procurement\QuoteController::class, 'destroy']);
            Route::get('requests/{procurementRequest}/quotes/{quote}/attachments',                       [\App\Http\Controllers\Api\V1\Procurement\QuoteAttachmentController::class, 'index']);
            Route::post('requests/{procurementRequest}/quotes/{quote}/attachments',                      [\App\Http\Controllers\Api\V1\Procurement\QuoteAttachmentController::class, 'store']);
            Route::delete('requests/{procurementRequest}/quotes/{quote}/attachments/{attachment}',       [\App\Http\Controllers\Api\V1\Procurement\QuoteAttachmentController::class, 'destroy']);
            Route::get('requests/{procurementRequest}/quotes/{quote}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Procurement\QuoteAttachmentController::class, 'download']);

            // Budget Reservations
            Route::get('budget-reservations', [\App\Http\Controllers\Api\V1\Procurement\BudgetReservationController::class, 'index']);
            Route::delete('budget-reservations/{budgetReservation}', [\App\Http\Controllers\Api\V1\Procurement\BudgetReservationController::class, 'destroy']);

            // Vendors
            Route::apiResource('vendors', \App\Http\Controllers\Api\V1\Procurement\VendorController::class)
                ->names('procurement.vendors');
            Route::get('supplier-categories', [\App\Http\Controllers\Api\V1\Procurement\SupplierCategoryController::class, 'index']);
            Route::post('supplier-categories', [\App\Http\Controllers\Api\V1\Procurement\SupplierCategoryController::class, 'store']);
            Route::put('supplier-categories/{supplierCategory}', [\App\Http\Controllers\Api\V1\Procurement\SupplierCategoryController::class, 'update']);
            Route::delete('supplier-categories/{supplierCategory}', [\App\Http\Controllers\Api\V1\Procurement\SupplierCategoryController::class, 'destroy']);
            Route::post('vendors/{vendor}/approve',     [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'approve']);
            Route::post('vendors/{vendor}/reject',      [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'reject']);
            Route::post('vendors/{vendor}/request-info', [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'requestInfo']);
            Route::post('vendors/{vendor}/suspend', [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'suspend']);
            Route::get('vendors/{vendor}/approval-logs', [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'approvalLogs']);
            Route::get('vendors/{vendor}/ratings',      [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'listRatings']);
            Route::post('vendors/{vendor}/ratings',     [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'storeRating']);
            Route::get('vendors/{vendor}/contracts',    [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'listContracts']);
            Route::post('vendors/{vendor}/blacklist',   [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'blacklist']);
            Route::post('vendors/{vendor}/unblacklist', [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'unblacklist']);
            Route::post('vendors/{vendor}/portal-users/{portalUser}/change-password', [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'changePortalUserPassword']);
            Route::get('vendors/{vendor}/evaluations',  [\App\Http\Controllers\Api\V1\Procurement\VendorPerformanceController::class, 'index']);
            Route::post('vendors/{vendor}/evaluations', [\App\Http\Controllers\Api\V1\Procurement\VendorPerformanceController::class, 'store']);

            Route::prefix('supplier')->group(function () {
                Route::get('me', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalController::class, 'me']);
                Route::put('profile', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalController::class, 'updateProfile']);
                Route::get('dashboard', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalController::class, 'dashboard']);
                Route::get('rfqs', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalController::class, 'rfqs']);
                Route::get('rfqs/{procurementRequest}', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalController::class, 'showRfq']);
                Route::post('rfqs/{procurementRequest}/quote', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalController::class, 'submitQuote']);
                Route::get('purchase-orders', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalController::class, 'purchaseOrders']);
                Route::post('purchase-orders/{purchaseOrder}/proforma-invoice', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalController::class, 'submitProformaInvoice']);
                Route::get('invoices', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalController::class, 'invoices']);
                Route::post('invoices/{invoice}/final-invoice', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalController::class, 'submitFinalInvoice']);
            });

            // Purchase Orders
            Route::apiResource('purchase-orders', \App\Http\Controllers\Api\V1\Procurement\PurchaseOrderController::class)
                ->parameters(['purchase-orders' => 'purchaseOrder'])
                ->names('procurement.purchase-orders');
            Route::post('purchase-orders/{purchaseOrder}/issue',  [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderController::class, 'issue']);
            Route::post('purchase-orders/{purchaseOrder}/cancel', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderController::class, 'cancel']);

            // Invoices
            Route::apiResource('invoices', \App\Http\Controllers\Api\V1\Procurement\InvoiceController::class)
                ->only(['index', 'show', 'store']);
            Route::post('invoices/{invoice}/approve', [\App\Http\Controllers\Api\V1\Procurement\InvoiceController::class, 'approve']);
            Route::post('invoices/{invoice}/reject',  [\App\Http\Controllers\Api\V1\Procurement\InvoiceController::class, 'reject']);
            Route::post('invoices/{invoice}/mark-paid',  [\App\Http\Controllers\Api\V1\Procurement\InvoiceController::class, 'markPaid']);

            // Contracts
            Route::apiResource('contracts', \App\Http\Controllers\Api\V1\Procurement\ContractController::class)
                ->only(['index', 'show', 'store', 'destroy']);
            Route::post('contracts/{contract}/activate',  [\App\Http\Controllers\Api\V1\Procurement\ContractController::class, 'activate']);
            Route::post('contracts/{contract}/terminate', [\App\Http\Controllers\Api\V1\Procurement\ContractController::class, 'terminate']);
            Route::get('contracts/{contract}/milestones', [\App\Http\Controllers\Api\V1\Procurement\ContractMilestoneController::class, 'index']);
            Route::post('contracts/{contract}/milestones', [\App\Http\Controllers\Api\V1\Procurement\ContractMilestoneController::class, 'store']);
            Route::put('contracts/{contract}/milestones/{milestone}', [\App\Http\Controllers\Api\V1\Procurement\ContractMilestoneController::class, 'update']);
            Route::post('contracts/{contract}/milestones/{milestone}/complete', [\App\Http\Controllers\Api\V1\Procurement\ContractMilestoneController::class, 'complete']);
            Route::delete('contracts/{contract}/milestones/{milestone}', [\App\Http\Controllers\Api\V1\Procurement\ContractMilestoneController::class, 'destroy']);

            Route::get('tenders', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'index']);
            Route::post('tenders', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'store']);
            Route::get('tenders/{tender}', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'show']);
            Route::post('tenders/{tender}/publish', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'publish']);
            Route::post('tenders/{tender}/close', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'close']);
            Route::post('tenders/{tender}/open-bids', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'openBids']);
            Route::post('tenders/{tender}/start-evaluation', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'startEvaluation']);
            Route::post('tenders/{tender}/comparison-summary', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'comparisonSummary']);
            Route::get('evaluations', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'evaluations']);
            Route::get('bid-submissions', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'bidSubmissions']);
            Route::get('notice-board', [\App\Http\Controllers\Api\V1\Procurement\PublicNoticeController::class, 'staffIndex']);

            Route::get('policy-profiles', [\App\Http\Controllers\Api\V1\Procurement\ProcurementPolicyProfileController::class, 'index']);
            Route::post('policy-profiles', [\App\Http\Controllers\Api\V1\Procurement\ProcurementPolicyProfileController::class, 'store']);
            Route::get('policy-profiles/{policyProfile}', [\App\Http\Controllers\Api\V1\Procurement\ProcurementPolicyProfileController::class, 'show']);
            Route::put('policy-profiles/{policyProfile}', [\App\Http\Controllers\Api\V1\Procurement\ProcurementPolicyProfileController::class, 'update']);
            Route::delete('policy-profiles/{policyProfile}', [\App\Http\Controllers\Api\V1\Procurement\ProcurementPolicyProfileController::class, 'destroy']);
            Route::post('policy-profiles/{policyProfile}/activate', [\App\Http\Controllers\Api\V1\Procurement\ProcurementPolicyProfileController::class, 'activate']);

            Route::get('tender-committees', [\App\Http\Controllers\Api\V1\Procurement\TenderCommitteeController::class, 'index']);
            Route::post('tender-committees', [\App\Http\Controllers\Api\V1\Procurement\TenderCommitteeController::class, 'store']);
            Route::get('tender-committees/{tenderCommittee}', [\App\Http\Controllers\Api\V1\Procurement\TenderCommitteeController::class, 'show']);
            Route::post('tender-committees/{tenderCommittee}/meetings', [\App\Http\Controllers\Api\V1\Procurement\TenderCommitteeController::class, 'storeMeeting']);

            Route::get('plans', [\App\Http\Controllers\Api\V1\Procurement\AnnualProcurementPlanController::class, 'index']);
            Route::post('plans', [\App\Http\Controllers\Api\V1\Procurement\AnnualProcurementPlanController::class, 'store']);
            Route::get('plans/{plan}', [\App\Http\Controllers\Api\V1\Procurement\AnnualProcurementPlanController::class, 'show']);
            Route::post('plans/{plan}/items', [\App\Http\Controllers\Api\V1\Procurement\AnnualProcurementPlanController::class, 'storeItem']);
            Route::delete('plans/{plan}', [\App\Http\Controllers\Api\V1\Procurement\AnnualProcurementPlanController::class, 'destroy']);

            Route::get('catalogue', [\App\Http\Controllers\Api\V1\Procurement\VendorCatalogueController::class, 'index']);
            Route::post('catalogue', [\App\Http\Controllers\Api\V1\Procurement\VendorCatalogueController::class, 'store']);
            Route::get('catalogue/{catalogue}', [\App\Http\Controllers\Api\V1\Procurement\VendorCatalogueController::class, 'show']);
            Route::put('catalogue/{catalogue}', [\App\Http\Controllers\Api\V1\Procurement\VendorCatalogueController::class, 'update']);
            Route::get('catalogue/{catalogue}/history', [\App\Http\Controllers\Api\V1\Procurement\VendorCatalogueController::class, 'history']);
            Route::delete('catalogue/{catalogue}', [\App\Http\Controllers\Api\V1\Procurement\VendorCatalogueController::class, 'destroy']);

            // Analytics
            Route::prefix('analytics')->group(function () {
                Route::get('summary',            [\App\Http\Controllers\Api\V1\Procurement\ProcurementAnalyticsController::class, 'summary']);
                Route::get('spend-by-category',  [\App\Http\Controllers\Api\V1\Procurement\ProcurementAnalyticsController::class, 'spendByCategory']);
                Route::get('vendor-performance', [\App\Http\Controllers\Api\V1\Procurement\ProcurementAnalyticsController::class, 'vendorPerformance']);
                Route::get('flags',              [\App\Http\Controllers\Api\V1\Procurement\ProcurementAnalyticsController::class, 'flags']);
            });

            // Goods Receipts — top-level listing
            Route::get('receipts', [\App\Http\Controllers\Api\V1\Procurement\GoodsReceiptController::class, 'indexAll']);

            // Goods Receipts (nested under POs)
            Route::get('purchase-orders/{purchaseOrder}/receipts',             [\App\Http\Controllers\Api\V1\Procurement\GoodsReceiptController::class, 'index']);
            Route::post('purchase-orders/{purchaseOrder}/receipts',            [\App\Http\Controllers\Api\V1\Procurement\GoodsReceiptController::class, 'store']);
            Route::get('purchase-orders/{purchaseOrder}/receipts/{receipt}',   [\App\Http\Controllers\Api\V1\Procurement\GoodsReceiptController::class, 'show']);
            Route::post('purchase-orders/{purchaseOrder}/receipts/{receipt}/accept', [\App\Http\Controllers\Api\V1\Procurement\GoodsReceiptController::class, 'accept']);
            Route::post('purchase-orders/{purchaseOrder}/receipts/{receipt}/reject', [\App\Http\Controllers\Api\V1\Procurement\GoodsReceiptController::class, 'reject']);

            // Procurement Request Attachments
            Route::get('requests/{procurementRequest}/attachments',                            [\App\Http\Controllers\Api\V1\Procurement\ProcurementRequestAttachmentController::class, 'index']);
            Route::post('requests/{procurementRequest}/attachments',                           [\App\Http\Controllers\Api\V1\Procurement\ProcurementRequestAttachmentController::class, 'store']);
            Route::delete('requests/{procurementRequest}/attachments/{attachment}',            [\App\Http\Controllers\Api\V1\Procurement\ProcurementRequestAttachmentController::class, 'destroy']);
            Route::get('requests/{procurementRequest}/attachments/{attachment}/download',      [\App\Http\Controllers\Api\V1\Procurement\ProcurementRequestAttachmentController::class, 'download']);

            // Purchase Order Attachments
            Route::get('purchase-orders/{purchaseOrder}/attachments',                          [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderAttachmentController::class, 'index']);
            Route::post('purchase-orders/{purchaseOrder}/attachments',                         [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderAttachmentController::class, 'store']);
            Route::delete('purchase-orders/{purchaseOrder}/attachments/{attachment}',          [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderAttachmentController::class, 'destroy']);
            Route::get('purchase-orders/{purchaseOrder}/attachments/{attachment}/download',    [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderAttachmentController::class, 'download']);

            // Invoice Attachments
            Route::get('invoices/{invoice}/attachments',                                       [\App\Http\Controllers\Api\V1\Procurement\InvoiceAttachmentController::class, 'index']);
            Route::post('invoices/{invoice}/attachments',                                      [\App\Http\Controllers\Api\V1\Procurement\InvoiceAttachmentController::class, 'store']);
            Route::delete('invoices/{invoice}/attachments/{attachment}',                       [\App\Http\Controllers\Api\V1\Procurement\InvoiceAttachmentController::class, 'destroy']);
            Route::get('invoices/{invoice}/attachments/{attachment}/download',                 [\App\Http\Controllers\Api\V1\Procurement\InvoiceAttachmentController::class, 'download']);

            // Contract Attachments
            Route::get('contracts/{contract}/attachments',                                     [\App\Http\Controllers\Api\V1\Procurement\ContractAttachmentController::class, 'index']);
            Route::post('contracts/{contract}/attachments',                                    [\App\Http\Controllers\Api\V1\Procurement\ContractAttachmentController::class, 'store']);
            Route::delete('contracts/{contract}/attachments/{attachment}',                     [\App\Http\Controllers\Api\V1\Procurement\ContractAttachmentController::class, 'destroy']);
            Route::get('contracts/{contract}/attachments/{attachment}/download',               [\App\Http\Controllers\Api\V1\Procurement\ContractAttachmentController::class, 'download']);

            // Goods Receipt Attachments
            Route::get('receipts/{goodsReceiptNote}/attachments',                              [\App\Http\Controllers\Api\V1\Procurement\GoodsReceiptAttachmentController::class, 'index']);
            Route::post('receipts/{goodsReceiptNote}/attachments',                             [\App\Http\Controllers\Api\V1\Procurement\GoodsReceiptAttachmentController::class, 'store']);
            Route::delete('receipts/{goodsReceiptNote}/attachments/{attachment}',              [\App\Http\Controllers\Api\V1\Procurement\GoodsReceiptAttachmentController::class, 'destroy']);
            Route::get('receipts/{goodsReceiptNote}/attachments/{attachment}/download',        [\App\Http\Controllers\Api\V1\Procurement\GoodsReceiptAttachmentController::class, 'download']);

            // Vendor Attachments
            Route::get('vendors/{vendor}/attachments',                                         [\App\Http\Controllers\Api\V1\Procurement\VendorAttachmentController::class, 'index']);
            Route::post('vendors/{vendor}/attachments',                                        [\App\Http\Controllers\Api\V1\Procurement\VendorAttachmentController::class, 'store']);
            Route::delete('vendors/{vendor}/attachments/{attachment}',                         [\App\Http\Controllers\Api\V1\Procurement\VendorAttachmentController::class, 'destroy']);
            Route::get('vendors/{vendor}/attachments/{attachment}/download',                   [\App\Http\Controllers\Api\V1\Procurement\VendorAttachmentController::class, 'download']);
        });

        // Budget Management — availability, commitments, actuals (Phase 1)
        Route::prefix('budget')->group(function () {
            Route::get('financial-years', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'financialYears']);
            Route::post('financial-years', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'storeFinancialYear']);
            Route::get('funding-sources', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'fundingSources']);
            Route::post('funding-sources', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'storeFundingSource']);
            Route::get('lines', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'lines']);
            Route::get('lines/{budgetLine}/availability', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'availability']);
            Route::post('availability/check', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'checkAvailability']);
            Route::post('commitments/reserve', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'reserve']);
            Route::post('commitments/{commitment}/confirm', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'confirm']);
            Route::post('commitments/{commitment}/adjust', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'adjust']);
            Route::post('commitments/{commitment}/transfer', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'transfer']);
            Route::post('commitments/{commitment}/release', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'release']);
            Route::post('commitments/{commitment}/consume', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'consume']);
            Route::post('actuals', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'postActual']);
            Route::post('actuals/import', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'importActuals']);
            Route::get('variance', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'variances']);
            Route::post('variance/scan', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'scanVariances']);
            Route::post('variance/{variance}/explanation', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'explainVariance']);
            Route::post('variance/explanations/{explanation}/review', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'reviewVarianceExplanation']);

            // Phase 2 A1 — annual cycle
            Route::get('cycles', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'index']);
            Route::post('cycles', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'store']);
            Route::get('cycles/{cycle}', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'show']);
            Route::post('cycles/{cycle}/guidelines', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'publishGuidelines']);
            Route::post('cycles/{cycle}/advance', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'advance']);
            Route::post('cycles/{cycle}/return', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'returnToDepartments']);
            Route::post('cycles/{cycle}/sg-approve', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'sgApprove']);
            Route::post('cycles/{cycle}/lock', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'lock']);
            Route::get('cycles/{cycle}/decisions', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'indexDecisions']);
            Route::post('cycles/{cycle}/decisions', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'storeDecision']);

            Route::get('submissions', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'indexSubmissions']);
            Route::post('submissions', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'storeSubmission']);
            Route::get('submissions/{submission}', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'showSubmission']);
            Route::put('submissions/{submission}', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'updateSubmission']);
            Route::post('submissions/{submission}/submit', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'submitSubmission']);
            Route::post('submissions/{submission}/accept', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'acceptSubmission']);
            Route::post('submissions/{submission}/consolidate', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'consolidateSubmission']);
            Route::post('submissions/{submission}/return', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'returnSubmission']);

            // Phase 2 B — mid-year change control
            Route::get('changes', [\App\Http\Controllers\Api\V1\Budget\BudgetChangeController::class, 'index']);
            Route::post('changes', [\App\Http\Controllers\Api\V1\Budget\BudgetChangeController::class, 'store']);
            Route::get('changes/{change}', [\App\Http\Controllers\Api\V1\Budget\BudgetChangeController::class, 'show']);
            Route::put('changes/{change}', [\App\Http\Controllers\Api\V1\Budget\BudgetChangeController::class, 'update']);
            Route::post('changes/{change}/submit', [\App\Http\Controllers\Api\V1\Budget\BudgetChangeController::class, 'submit']);
            Route::post('changes/{change}/finance-decide', [\App\Http\Controllers\Api\V1\Budget\BudgetChangeController::class, 'financeDecide']);
            Route::post('changes/{change}/sg-decide', [\App\Http\Controllers\Api\V1\Budget\BudgetChangeController::class, 'sgDecide']);
            Route::post('changes/{change}/apply', [\App\Http\Controllers\Api\V1\Budget\BudgetChangeController::class, 'apply']);

            // Read-only reports pack
            Route::get('reports/utilisation', [\App\Http\Controllers\Api\V1\Budget\BudgetReportController::class, 'utilisation']);
            Route::get('reports/commitment-ageing', [\App\Http\Controllers\Api\V1\Budget\BudgetReportController::class, 'commitmentAgeing']);
            Route::get('reports/change-register', [\App\Http\Controllers\Api\V1\Budget\BudgetReportController::class, 'changeRegister']);
            Route::get('reports/cycle-status', [\App\Http\Controllers\Api\V1\Budget\BudgetReportController::class, 'cycleStatus']);

            // Cashflow / scenario planning
            Route::get('cashflow/forecast', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'forecast']);
            Route::get('cashflow/forecast/export', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'exportForecast']);
            Route::get('cashflow/compare', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'compare']);
            Route::get('cashflow/compare/export', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'exportCompare']);
            Route::get('cashflow/inflows', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'indexInflows']);
            Route::post('cashflow/inflows', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'storeInflow']);
            Route::put('cashflow/inflows/{inflow}', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'updateInflow']);
            Route::delete('cashflow/inflows/{inflow}', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'destroyInflow']);
            Route::get('cashflow/scenarios', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'indexScenarios']);
            Route::post('cashflow/scenarios', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'storeScenario']);
            Route::get('cashflow/scenarios/{scenario}', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'showScenario']);
            Route::put('cashflow/scenarios/{scenario}', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'updateScenario']);
            Route::delete('cashflow/scenarios/{scenario}', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'destroyScenario']);
            Route::post('cashflow/scenarios/{scenario}/adjustments', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'storeAdjustment']);
            Route::delete('cashflow/scenarios/{scenario}/adjustments/{adjustment}', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'destroyAdjustment']);
        });

        // Finance - Salary Advances, Payslips, Summary, and Budgets
        Route::prefix('finance')->group(function () {
            Route::apiResource('budgets', \App\Http\Controllers\Api\V1\Finance\BudgetController::class);
            Route::get('summary', [\App\Http\Controllers\Api\V1\Finance\FinanceSummaryController::class, 'summary']);
            Route::get('payslips', [\App\Http\Controllers\Api\V1\Finance\PayslipController::class, 'index']);
            Route::get('payslips/{payslip}', [\App\Http\Controllers\Api\V1\Finance\PayslipController::class, 'show']);
            Route::get('payslips/{payslip}/download', [\App\Http\Controllers\Api\V1\Finance\PayslipController::class, 'download']);
            Route::get('advances/eligibility', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'eligibility']);
            Route::get('advances/dashboard', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'dashboard']);
            Route::get('advances/employee-summary', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'employeeSummary']);
            Route::get('advances/reconciliations', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'reconciliations']);
            Route::get('advances/policies', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'policies']);
            Route::post('advances/policies', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'storePolicy']);
            Route::get('advances/payroll-integration', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'payrollIntegration']);
            Route::get('advances/policy-exceptions', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'policyExceptions']);
            Route::post('advances/policy-exceptions', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'storePolicyException']);
            Route::post('advances/policy-exceptions/{exception}/approve', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'approvePolicyException']);
            Route::post('advances/policy-exceptions/{exception}/revoke', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'revokePolicyException']);
            Route::get('advances', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'index']);
            Route::post('advances', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'store']);
            Route::get('advances/{salaryAdvanceRequest}', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'show']);
            Route::put('advances/{salaryAdvanceRequest}', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'update']);
            Route::delete('advances/{salaryAdvanceRequest}', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'destroy']);
            Route::post('advances/{salaryAdvanceRequest}/submit',   [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'submit']);
            Route::post('advances/{salaryAdvanceRequest}/finance-certify', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'financeCertify']);
            Route::post('advances/{salaryAdvanceRequest}/finance-return', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'financeReturn']);
            Route::post('advances/{salaryAdvanceRequest}/mark-not-eligible', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'markNotEligible']);
            Route::post('advances/{salaryAdvanceRequest}/approve',  [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'approve']);
            Route::post('advances/{salaryAdvanceRequest}/reject',   [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'reject']);
            Route::post('advances/{salaryAdvanceRequest}/return',   [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'returnForCorrection']);
            Route::post('advances/{salaryAdvanceRequest}/withdraw', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'withdraw']);
            Route::post('advances/{salaryAdvanceRequest}/resubmit', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'resubmit']);
            Route::post('advances/{salaryAdvanceRequest}/record-payment', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'recordPayment']);
            Route::post('advances/{salaryAdvanceRequest}/schedule-recovery', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'scheduleRecovery']);
            Route::post('advances/{salaryAdvanceRequest}/record-recovery', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'recordRecovery']);
            Route::post('advances/{salaryAdvanceRequest}/close', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'close']);
            Route::post('advances/{salaryAdvanceRequest}/reconciliations/{reconciliation}/resolve', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'resolveReconciliation']);
            Route::get('advances/{salaryAdvanceRequest}/ledger', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'ledger']);
            Route::get('advances/{salaryAdvanceRequest}/pdf', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'pdf']);
            Route::get('advances/{salaryAdvanceRequest}/certificate', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'certificate']);

            // Balance Control & Reconciliation Engine (BCRE)
            Route::prefix('balance-registers')->group(function () {
                Route::get('dashboard',  [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'dashboard']);
                Route::get('exceptions', [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'exceptions']);
                Route::get('/',    [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'index']);
                Route::post('/',   [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'store']);
                Route::get('{balanceRegister}',    [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'show']);
                Route::put('{balanceRegister}',    [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'update']);
                Route::post('{balanceRegister}/lock',        [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'lock']);
                Route::post('{balanceRegister}/unlock',      [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'unlock']);
                Route::post('{balanceRegister}/acknowledge', [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'acknowledge']);
                Route::get('{balanceRegister}/transactions',  [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'transactions']);
                Route::post('{balanceRegister}/transactions', [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'storeTransaction']);
                Route::get('{balanceRegister}/transactions/{balanceTransaction}/verify',  [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'getVerification']);
                Route::post('{balanceRegister}/transactions/{balanceTransaction}/verify', [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'storeVerification']);
            });
        });

        // HR - Timesheets & Summary
        Route::prefix('hr')->group(function () {
            Route::get('summary', [\App\Http\Controllers\Api\V1\Hr\HrSummaryController::class, 'summary']);

            // Payslip salary confirmation (HR only)
            Route::post('payslips/{payslip}/confirm', [\App\Http\Controllers\Api\V1\Hr\PayslipConfirmationController::class, 'confirm']);

            // Profile Change Approval (HR)
            Route::get('profile-requests', [\App\Http\Controllers\Api\V1\Hr\ProfileRequestController::class, 'index']);
            Route::get('profile-requests/{profileChangeRequest}', [\App\Http\Controllers\Api\V1\Hr\ProfileRequestController::class, 'show']);
            Route::post('profile-requests/{profileChangeRequest}/approve', [\App\Http\Controllers\Api\V1\Hr\ProfileRequestController::class, 'approve']);
            Route::post('profile-requests/{profileChangeRequest}/reject', [\App\Http\Controllers\Api\V1\Hr\ProfileRequestController::class, 'reject']);
            Route::get('timesheets', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'index']);
            Route::post('timesheets/import', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'import']);
            Route::get('timesheets/team', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'team']);
            Route::get('timesheets/leave-days', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'leaveDays']);
            Route::get('timesheets/travel-days', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'travelDays']);
            Route::get('timesheets/holiday-dates', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'holidayDates']);
            Route::get('timesheets/templates', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'templates']);
            Route::post('timesheets/templates', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'storeTemplate']);
            Route::put('timesheets/templates/{template}', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'updateTemplate']);
            Route::post('timesheets/templates/{template}/deactivate', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'deactivateTemplate']);
            Route::post('timesheets/templates/{template}/apply', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'applyTemplate']);
            Route::get('timesheets/expected-hours', [\App\Http\Controllers\Api\V1\Hr\WorkScheduleController::class, 'expectedHours']);
            Route::get('timesheets/periods', [\App\Http\Controllers\Api\V1\Hr\WorkScheduleController::class, 'periods']);
            Route::post('timesheets/periods/{timesheetPeriod}/close', [\App\Http\Controllers\Api\V1\Hr\WorkScheduleController::class, 'closePeriod']);
            Route::get('timesheets/schedules', [\App\Http\Controllers\Api\V1\Hr\WorkScheduleController::class, 'index']);
            Route::post('timesheets/schedules', [\App\Http\Controllers\Api\V1\Hr\WorkScheduleController::class, 'store']);
            Route::post('timesheets/schedules/assign', [\App\Http\Controllers\Api\V1\Hr\WorkScheduleController::class, 'assign']);
            Route::post('timesheets/payroll-exports', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'exportPayroll']);
            Route::get('timesheets/{timesheet}/export', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'export']);
            Route::get('timesheets/{timesheet}', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'show']);
            Route::post('timesheets', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'store']);
            Route::put('timesheets/{timesheet}', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'update']);
            Route::post('timesheets/{timesheet}/submit', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'submit']);
            Route::post('timesheets/{timesheet}/return', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'returnTimesheet']);
            Route::post('timesheets/{timesheet}/approve', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'approve']);
            Route::post('timesheets/{timesheet}/reject', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'reject']);

            // Overtime requisitions / actuals / settlement (PRD §89)
            Route::get('overtime-requisitions', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'index']);
            Route::post('overtime-requisitions', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'store']);
            Route::get('overtime-requisitions/{overtimeRequisition}', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'show']);
            Route::post('overtime-requisitions/{overtimeRequisition}/submit', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'submit']);
            Route::post('overtime-requisitions/{overtimeRequisition}/recommend', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'recommend']);
            Route::post('overtime-requisitions/{overtimeRequisition}/approve', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'approve']);
            Route::post('overtime-requisitions/{overtimeRequisition}/reject', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'reject']);
            Route::post('overtime-requisitions/{overtimeRequisition}/actuals', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'recordActual']);
            Route::post('overtime-actuals/{overtimeActual}/hr-validate', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'hrValidate']);
            Route::post('overtime-actuals/{overtimeActual}/send-to-payroll', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'sendToPayroll']);
            Route::post('overtime-actuals/{overtimeActual}/send-to-toil', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'sendToToil']);
            Route::get('incidents', [\App\Http\Controllers\Api\V1\Hr\HrIncidentController::class, 'index']);
            Route::post('incidents', [\App\Http\Controllers\Api\V1\Hr\HrIncidentController::class, 'store']);
            Route::get('incidents/{hrIncident}', [\App\Http\Controllers\Api\V1\Hr\HrIncidentController::class, 'show']);
            Route::put('incidents/{hrIncident}', [\App\Http\Controllers\Api\V1\Hr\HrIncidentController::class, 'update']);
            Route::delete('incidents/{hrIncident}', [\App\Http\Controllers\Api\V1\Hr\HrIncidentController::class, 'destroy']);
        });

        // HR - Work Assignments
        Route::prefix('hr')->group(function () {
            Route::get('assignments/stats', [\App\Http\Controllers\Api\V1\Hr\WorkAssignmentController::class, 'stats']);
            Route::apiResource('assignments', \App\Http\Controllers\Api\V1\Hr\WorkAssignmentController::class)
                ->only(['index', 'store', 'show', 'update'])
                ->parameters(['assignment' => 'workAssignment'])
                ->names('hr.assignments');
            Route::post('assignments/{workAssignment}/updates', [\App\Http\Controllers\Api\V1\Hr\WorkAssignmentController::class, 'addUpdate']);
            Route::post('assignments/{workAssignment}/start', [\App\Http\Controllers\Api\V1\Hr\WorkAssignmentController::class, 'start']);
            Route::post('assignments/{workAssignment}/complete', [\App\Http\Controllers\Api\V1\Hr\WorkAssignmentController::class, 'complete']);
        });

        // HR - Performance Tracker
        Route::prefix('hr')->group(function () {
            Route::get('performance/overview', [\App\Http\Controllers\Api\V1\Hr\PerformanceTrackerController::class, 'overview']);
            Route::get('performance/team', [\App\Http\Controllers\Api\V1\Hr\PerformanceTrackerController::class, 'team']);
            Route::get('performance', [\App\Http\Controllers\Api\V1\Hr\PerformanceTrackerController::class, 'index']);
            Route::post('performance', [\App\Http\Controllers\Api\V1\Hr\PerformanceTrackerController::class, 'store']);
            Route::get('performance/{performanceTracker}', [\App\Http\Controllers\Api\V1\Hr\PerformanceTrackerController::class, 'show']);
            Route::put('performance/{performanceTracker}', [\App\Http\Controllers\Api\V1\Hr\PerformanceTrackerController::class, 'update']);
            Route::delete('performance/{performanceTracker}', [\App\Http\Controllers\Api\V1\Hr\PerformanceTrackerController::class, 'destroy']);

            // HR Documents (aggregated list across all HR personal files — HR admin sees all, staff sees own)
            Route::get('documents', [\App\Http\Controllers\Api\V1\Hr\HrDocumentsController::class, 'index']);
            // HR Personal Files
            Route::get('files', [\App\Http\Controllers\Api\V1\Hr\HrPersonalFileController::class, 'index']);
            Route::post('files', [\App\Http\Controllers\Api\V1\Hr\HrPersonalFileController::class, 'store']);
            Route::get('files/{hrPersonalFile}', [\App\Http\Controllers\Api\V1\Hr\HrPersonalFileController::class, 'show']);
            Route::put('files/{hrPersonalFile}', [\App\Http\Controllers\Api\V1\Hr\HrPersonalFileController::class, 'update']);
            Route::get('files/{hrPersonalFile}/timeline', [\App\Http\Controllers\Api\V1\Hr\HrPersonalFileController::class, 'timeline']);
            Route::post('files/{hrPersonalFile}/timeline', [\App\Http\Controllers\Api\V1\Hr\HrPersonalFileController::class, 'addTimelineEvent']);
            Route::get('files/{hrPersonalFile}/documents', [\App\Http\Controllers\Api\V1\Hr\HrPersonalFileController::class, 'documents']);
            Route::post('files/{hrPersonalFile}/documents', [\App\Http\Controllers\Api\V1\Hr\HrPersonalFileController::class, 'uploadDocument']);
            Route::delete('files/{hrPersonalFile}/documents/{document}', [\App\Http\Controllers\Api\V1\Hr\HrPersonalFileController::class, 'deleteDocument']);

            // Performance Appraisal
            Route::get('appraisal-cycles', [\App\Http\Controllers\Api\V1\Hr\AppraisalController::class, 'cycles']);
            Route::get('appraisals', [\App\Http\Controllers\Api\V1\Hr\AppraisalController::class, 'index']);
            Route::get('appraisals/{appraisal}', [\App\Http\Controllers\Api\V1\Hr\AppraisalController::class, 'show']);
            Route::post('appraisals', [\App\Http\Controllers\Api\V1\Hr\AppraisalController::class, 'store']);
            Route::put('appraisals/{appraisal}', [\App\Http\Controllers\Api\V1\Hr\AppraisalController::class, 'update']);
            Route::delete('appraisals/{appraisal}', [\App\Http\Controllers\Api\V1\Hr\AppraisalController::class, 'destroy']);
            Route::post('appraisals/{appraisal}/submit-self-assessment', [\App\Http\Controllers\Api\V1\Hr\AppraisalController::class, 'submitSelfAssessment']);
            Route::post('appraisals/{appraisal}/supervisor-review', [\App\Http\Controllers\Api\V1\Hr\AppraisalController::class, 'supervisorReview']);
            Route::post('appraisals/{appraisal}/hod-review', [\App\Http\Controllers\Api\V1\Hr\AppraisalController::class, 'hodReview']);
            Route::post('appraisals/{appraisal}/finalize', [\App\Http\Controllers\Api\V1\Hr\AppraisalController::class, 'finalize']);
            Route::post('appraisals/{appraisal}/acknowledge', [\App\Http\Controllers\Api\V1\Hr\AppraisalController::class, 'acknowledge']);
            Route::get('appraisals/{appraisal}/attachments', [\App\Http\Controllers\Api\V1\Hr\AppraisalAttachmentController::class, 'index']);
            Route::post('appraisals/{appraisal}/attachments', [\App\Http\Controllers\Api\V1\Hr\AppraisalAttachmentController::class, 'store']);
            Route::delete('appraisals/{appraisal}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Hr\AppraisalAttachmentController::class, 'destroy']);
            Route::get('appraisals/{appraisal}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Hr\AppraisalAttachmentController::class, 'download']);

            // Conduct, Discipline & Recognition
            Route::get('conduct', [\App\Http\Controllers\Api\V1\Hr\ConductRecordController::class, 'index']);
            Route::get('conduct/{conductRecord}', [\App\Http\Controllers\Api\V1\Hr\ConductRecordController::class, 'show']);
            Route::post('conduct', [\App\Http\Controllers\Api\V1\Hr\ConductRecordController::class, 'store']);
            Route::put('conduct/{conductRecord}', [\App\Http\Controllers\Api\V1\Hr\ConductRecordController::class, 'update']);
            Route::delete('conduct/{conductRecord}', [\App\Http\Controllers\Api\V1\Hr\ConductRecordController::class, 'destroy']);
        });

        // Programmes (PIF)
        Route::prefix('programmes')->group(function () {
            Route::apiResource('', \App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class)
                ->parameter('', 'programme')
                ->names('programmes');
            Route::post('{programme}/submit',  [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'submit']);
            Route::post('{programme}/approve', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'approve']);
            Route::post('{programme}/reject',  [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'reject']);
            Route::post('{programme}/amend', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'amend']);
            Route::post('{programme}/submit-amendment', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'submitAmendment']);
            Route::get('{programme}/diff', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'diff']);
            Route::post('{programme}/send-to-procurement', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'sendToProcurement']);
            Route::post('{programme}/send-to-travel', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'sendToTravel']);
            Route::get('{programme}/pdf', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'pdf']);
            Route::middleware('can:programme.finance-review')
                ->put('{programme}/finance-review', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'updateFinanceReview']);

            Route::apiResource('{programme}/activities',   \App\Http\Controllers\Api\V1\Programmes\ProgrammeActivityController::class)
                ->only(['store', 'update', 'destroy'])->parameters(['activities' => 'activity']);
            Route::apiResource('{programme}/milestones',   \App\Http\Controllers\Api\V1\Programmes\ProgrammeMilestoneController::class)
                ->only(['store', 'update', 'destroy'])->parameters(['milestones' => 'milestone']);
            Route::apiResource('{programme}/deliverables', \App\Http\Controllers\Api\V1\Programmes\ProgrammeDeliverableController::class)
                ->only(['store', 'update', 'destroy'])->parameters(['deliverables' => 'deliverable']);
            Route::apiResource('{programme}/budget-lines', \App\Http\Controllers\Api\V1\Programmes\ProgrammeBudgetLineController::class)
                ->only(['store', 'update', 'destroy'])->parameters(['budget-lines' => 'budgetLine']);
            Route::apiResource('{programme}/procurement',  \App\Http\Controllers\Api\V1\Programmes\ProgrammeProcurementItemController::class)
                ->only(['store', 'update', 'destroy'])->parameters(['procurement' => 'procurementItem']);
            Route::apiResource('{programme}/documents', \App\Http\Controllers\Api\V1\Programmes\ProgrammeDocumentController::class)
                ->only(['store', 'update', 'destroy'])->parameters(['documents' => 'document']);
            Route::apiResource('{programme}/arrival-departures', \App\Http\Controllers\Api\V1\Programmes\ProgrammeArrivalDepartureController::class)
                ->only(['store', 'update', 'destroy'])->parameters(['arrival-departures' => 'arrivalDeparture']);

            Route::get('{programme}/attachments', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeAttachmentController::class, 'index']);
            Route::post('{programme}/attachments', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeAttachmentController::class, 'store']);
            Route::put('{programme}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeAttachmentController::class, 'update']);
            Route::delete('{programme}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeAttachmentController::class, 'destroy']);
            Route::get('{programme}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeAttachmentController::class, 'download']);
        });

        // ── M&E / Results Monitoring (PRD §10 + §23.5) ─────────────────────────
        Route::prefix('mande')->group(function () {
            // Dashboard & strategic reporting (read — gated on mande.view)
            Route::middleware('can:mande.view')->group(function () {
                Route::get('dashboard',        [\App\Http\Controllers\Api\V1\MAndE\MeDashboardController::class, 'summary']);
                Route::get('reports/strategic',[\App\Http\Controllers\Api\V1\MAndE\MeReportingController::class, 'strategic']);
                Route::get('reports/donor',    [\App\Http\Controllers\Api\V1\MAndE\MeReportingController::class, 'donor']);
                Route::get('data-quality',     [\App\Http\Controllers\Api\V1\MAndE\MeDataQualityController::class, 'index']);
                Route::get('pif-linkages',     [\App\Http\Controllers\Api\V1\MAndE\MeActivityReportController::class, 'linkablePifs']);
                Route::get('settings',         [\App\Http\Controllers\Api\V1\MAndE\MeSettingsController::class, 'show']);
            });
            Route::middleware('can:mande.admin')->group(function () {
                Route::post('import/preview', [\App\Http\Controllers\Api\V1\MAndE\MeImportController::class, 'preview']);
                Route::post('import/commit',  [\App\Http\Controllers\Api\V1\MAndE\MeImportController::class, 'commit']);
            });
            Route::middleware('can:mande.admin')->put('settings', [\App\Http\Controllers\Api\V1\MAndE\MeSettingsController::class, 'update']);
            Route::middleware('can:mande.review')->post(
                'intake/{programme}/not-reportable',
                [\App\Http\Controllers\Api\V1\MAndE\MeActivityReportController::class, 'markNotReportable']
            );

            // Strategic Plans + nested configuration (§10.4) — admin-configurable
            Route::middleware('can:mande.view')->get('strategic-plans', [\App\Http\Controllers\Api\V1\MAndE\StrategicPlanController::class, 'index']);
            Route::middleware('can:mande.view')->get('strategic-plans/{strategicPlan}', [\App\Http\Controllers\Api\V1\MAndE\StrategicPlanController::class, 'show']);
            Route::middleware('can:mande.admin')->group(function () {
                Route::post('strategic-plans',                       [\App\Http\Controllers\Api\V1\MAndE\StrategicPlanController::class, 'store']);
                Route::put('strategic-plans/{strategicPlan}',        [\App\Http\Controllers\Api\V1\MAndE\StrategicPlanController::class, 'update']);
                Route::delete('strategic-plans/{strategicPlan}',     [\App\Http\Controllers\Api\V1\MAndE\StrategicPlanController::class, 'destroy']);
                Route::post('strategic-plans/{strategicPlan}/archive',  [\App\Http\Controllers\Api\V1\MAndE\StrategicPlanController::class, 'archive']);
                Route::post('strategic-plans/{strategicPlan}/activate', [\App\Http\Controllers\Api\V1\MAndE\StrategicPlanController::class, 'activate']);
                Route::post('strategic-plans/{strategicPlan}/goals',    [\App\Http\Controllers\Api\V1\MAndE\StrategicPlanController::class, 'addGoal']);
                Route::post('strategic-goals/{goal}/objectives',        [\App\Http\Controllers\Api\V1\MAndE\StrategicPlanController::class, 'addObjective']);
                Route::post('strategic-objectives/{objective}/outcomes',[\App\Http\Controllers\Api\V1\MAndE\StrategicPlanController::class, 'addOutcome']);
                Route::post('strategic-outcomes/{outcome}/outputs',     [\App\Http\Controllers\Api\V1\MAndE\StrategicPlanController::class, 'addOutput']);
                Route::delete('strategic-nodes/{type}/{id}',            [\App\Http\Controllers\Api\V1\MAndE\StrategicPlanController::class, 'deleteNode']);
            });

            // Results Frameworks (§10.5)
            Route::middleware('can:mande.view')->get('results-frameworks', [\App\Http\Controllers\Api\V1\MAndE\ResultsFrameworkController::class, 'index']);
            Route::middleware('can:mande.view')->get('results-frameworks/{resultsFramework}', [\App\Http\Controllers\Api\V1\MAndE\ResultsFrameworkController::class, 'show']);
            Route::middleware('can:mande.admin')->group(function () {
                Route::post('results-frameworks',                       [\App\Http\Controllers\Api\V1\MAndE\ResultsFrameworkController::class, 'store']);
                Route::put('results-frameworks/{resultsFramework}',     [\App\Http\Controllers\Api\V1\MAndE\ResultsFrameworkController::class, 'update']);
                Route::delete('results-frameworks/{resultsFramework}',  [\App\Http\Controllers\Api\V1\MAndE\ResultsFrameworkController::class, 'destroy']);
            });

            // Indicators (§10.6)
            Route::middleware('can:mande.view')->get('indicators', [\App\Http\Controllers\Api\V1\MAndE\IndicatorController::class, 'index']);
            Route::middleware('can:mande.view')->get('indicators/{indicator}', [\App\Http\Controllers\Api\V1\MAndE\IndicatorController::class, 'show']);
            Route::middleware('can:mande.view')->get('indicators/{indicator}/versions', [\App\Http\Controllers\Api\V1\MAndE\IndicatorController::class, 'versions']);
            Route::middleware('can:mande.view')->get('calendar', [\App\Http\Controllers\Api\V1\MAndE\MeReportingController::class, 'calendar']);
            Route::middleware('can:mande.create')->group(function () {
                Route::post('indicators',               [\App\Http\Controllers\Api\V1\MAndE\IndicatorController::class, 'store']);
                Route::put('indicators/{indicator}',    [\App\Http\Controllers\Api\V1\MAndE\IndicatorController::class, 'update']);
                Route::delete('indicators/{indicator}', [\App\Http\Controllers\Api\V1\MAndE\IndicatorController::class, 'destroy']);
                Route::post('indicators/{indicator}/versions', [\App\Http\Controllers\Api\V1\MAndE\IndicatorController::class, 'createVersion']);
            });

            // Activity Reports (§10.7 + §10.8)
            Route::middleware('can:mande.view')->group(function () {
                Route::get('activity-reports',                  [\App\Http\Controllers\Api\V1\MAndE\MeActivityReportController::class, 'index']);
                Route::get('activity-reports/{activityReport}', [\App\Http\Controllers\Api\V1\MAndE\MeActivityReportController::class, 'show']);
                Route::get('activity-reports/{activityReport}/history', [\App\Http\Controllers\Api\V1\MAndE\MeActivityReportController::class, 'history']);
            });
            Route::middleware('can:mande.create')->group(function () {
                Route::post('activity-reports',                  [\App\Http\Controllers\Api\V1\MAndE\MeActivityReportController::class, 'store']);
                Route::put('activity-reports/{activityReport}',  [\App\Http\Controllers\Api\V1\MAndE\MeActivityReportController::class, 'update']);
                Route::delete('activity-reports/{activityReport}',[\App\Http\Controllers\Api\V1\MAndE\MeActivityReportController::class, 'destroy']);
                Route::post('activity-reports/{activityReport}/submit', [\App\Http\Controllers\Api\V1\MAndE\MeReviewController::class, 'submit']);
                Route::post('activity-reports/{activityReport}/follow-ups', [\App\Http\Controllers\Api\V1\MAndE\MeFollowUpController::class, 'store']);
                Route::put('activity-reports/{activityReport}/follow-ups/{followUp}', [\App\Http\Controllers\Api\V1\MAndE\MeFollowUpController::class, 'update']);
                Route::delete('activity-reports/{activityReport}/follow-ups/{followUp}', [\App\Http\Controllers\Api\V1\MAndE\MeFollowUpController::class, 'destroy']);
            });
            Route::middleware('can:mande.view')->get(
                'activity-reports/{activityReport}/follow-ups',
                [\App\Http\Controllers\Api\V1\MAndE\MeFollowUpController::class, 'index']
            );

            // Review workflow (§10.10) — reviewer actions gated on mande.review
            Route::middleware('can:mande.review')->group(function () {
                Route::get('programme-review-queue', [\App\Http\Controllers\Api\V1\MAndE\MeReviewController::class, 'programmeReviewQueue']);
                Route::post('activity-reports/{activityReport}/programme-review/clear', [\App\Http\Controllers\Api\V1\MAndE\MeReviewController::class, 'clearProgrammeReview']);
                Route::post('activity-reports/{activityReport}/programme-review/return', [\App\Http\Controllers\Api\V1\MAndE\MeReviewController::class, 'returnProgrammeReview']);
                Route::post('activity-reports/{activityReport}/review',  [\App\Http\Controllers\Api\V1\MAndE\MeReviewController::class, 'review']);
                Route::post('activity-reports/{activityReport}/return',  [\App\Http\Controllers\Api\V1\MAndE\MeReviewController::class, 'requestCorrection']);
                Route::post('activity-reports/{activityReport}/accept',  [\App\Http\Controllers\Api\V1\MAndE\MeReviewController::class, 'accept']);
                Route::post('activity-reports/{activityReport}/close',   [\App\Http\Controllers\Api\V1\MAndE\MeReviewController::class, 'close']);
            });

            // Evidence Repository (§10.9)
            Route::middleware('can:mande.view')->get('activity-reports/{activityReport}/evidence', [\App\Http\Controllers\Api\V1\MAndE\MeEvidenceController::class, 'index']);
            Route::middleware('can:mande.create')->post('activity-reports/{activityReport}/evidence', [\App\Http\Controllers\Api\V1\MAndE\MeEvidenceController::class, 'store']);
            Route::middleware('can:mande.review')->post('activity-reports/{activityReport}/evidence/{evidence}/review', [\App\Http\Controllers\Api\V1\MAndE\MeEvidenceController::class, 'review']);
            Route::middleware('can:mande.create')->delete('activity-reports/{activityReport}/evidence/{evidence}', [\App\Http\Controllers\Api\V1\MAndE\MeEvidenceController::class, 'destroy']);
            Route::middleware('can:mande.view')->get('activity-reports/{activityReport}/evidence/{evidence}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\MAndE\MeEvidenceController::class, 'download']);

            // Thematic Areas (admin-configurable lookup, §9.7/§27)
            Route::middleware('can:mande.view')->get('thematic-areas', [\App\Http\Controllers\Api\V1\MAndE\MeThematicAreaController::class, 'index']);
            Route::middleware('can:mande.admin')->group(function () {
                Route::post('thematic-areas',                  [\App\Http\Controllers\Api\V1\MAndE\MeThematicAreaController::class, 'store']);
                Route::put('thematic-areas/{thematicArea}',    [\App\Http\Controllers\Api\V1\MAndE\MeThematicAreaController::class, 'update']);
                Route::delete('thematic-areas/{thematicArea}', [\App\Http\Controllers\Api\V1\MAndE\MeThematicAreaController::class, 'destroy']);
            });
        });

        // Workplan
        Route::prefix('workplan')->group(function () {
            Route::get('meeting-types', [\App\Http\Controllers\Api\V1\Workplan\MeetingTypeController::class, 'index']);
            Route::post('meeting-types', [\App\Http\Controllers\Api\V1\Workplan\MeetingTypeController::class, 'store']);
            Route::put('meeting-types/{meetingType}', [\App\Http\Controllers\Api\V1\Workplan\MeetingTypeController::class, 'update']);
            Route::delete('meeting-types/{meetingType}', [\App\Http\Controllers\Api\V1\Workplan\MeetingTypeController::class, 'destroy']);
            Route::get('event-types', [\App\Http\Controllers\Api\V1\Workplan\WorkplanEventTypeController::class, 'index']);
            Route::post('event-types', [\App\Http\Controllers\Api\V1\Workplan\WorkplanEventTypeController::class, 'store']);
            Route::put('event-types/{eventType}', [\App\Http\Controllers\Api\V1\Workplan\WorkplanEventTypeController::class, 'update']);
            Route::delete('event-types/{eventType}', [\App\Http\Controllers\Api\V1\Workplan\WorkplanEventTypeController::class, 'destroy']);
            Route::get('events/{event}/attachments', [\App\Http\Controllers\Api\V1\Workplan\WorkplanAttachmentController::class, 'index']);
            Route::post('events/{event}/attachments', [\App\Http\Controllers\Api\V1\Workplan\WorkplanAttachmentController::class, 'store']);
            Route::delete('events/{event}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Workplan\WorkplanAttachmentController::class, 'destroy']);
            Route::get('events/{event}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Workplan\WorkplanAttachmentController::class, 'download']);
            Route::apiResource('events', \App\Http\Controllers\Api\V1\Workplan\WorkplanController::class)->parameters(['events' => 'event']);
        });

        // SADC PF Calendar, Public Holidays, UN Days
        Route::prefix('calendar')->group(function () {
            Route::get('entries', [\App\Http\Controllers\Api\V1\Calendar\CalendarController::class, 'index']);
            Route::get('entries/{calendarEntry}', [\App\Http\Controllers\Api\V1\Calendar\CalendarController::class, 'show']);
            Route::post('entries', [\App\Http\Controllers\Api\V1\Calendar\CalendarController::class, 'store']);
            Route::post('entries/upload', [\App\Http\Controllers\Api\V1\Calendar\CalendarController::class, 'upload']);
            Route::put('entries/{calendarEntry}', [\App\Http\Controllers\Api\V1\Calendar\CalendarController::class, 'update']);
            Route::delete('entries/{calendarEntry}', [\App\Http\Controllers\Api\V1\Calendar\CalendarController::class, 'destroy']);
        });

        // Analytics
        Route::get('analytics/summary', [\App\Http\Controllers\Api\V1\AnalyticsController::class, 'summary']);
        Route::get('analytics/module/{module}', [\App\Http\Controllers\Api\V1\AnalyticsController::class, 'byModule']);

        // Reports — gated on reports.view permission
        Route::middleware('can:reports.view')->group(function () {
            Route::get('reports/summary',         [\App\Http\Controllers\Api\V1\ReportsController::class, 'summary']);
            Route::get('reports/users',           [\App\Http\Controllers\Api\V1\ReportsController::class, 'reportUsers']);
            Route::get('reports/departments',     [\App\Http\Controllers\Api\V1\ReportsController::class, 'reportDepartments']);
            Route::get('reports/travel',          [\App\Http\Controllers\Api\V1\ReportsController::class, 'travel']);
            Route::get('reports/leave',           [\App\Http\Controllers\Api\V1\ReportsController::class, 'leave']);
            Route::get('reports/dsa',             [\App\Http\Controllers\Api\V1\ReportsController::class, 'dsa']);
            Route::get('reports/assets',          [\App\Http\Controllers\Api\V1\ReportsController::class, 'assets']);
            Route::get('reports/stock',           [\App\Http\Controllers\Api\V1\ReportsController::class, 'stock']);
            Route::get('reports/imprest',         [\App\Http\Controllers\Api\V1\ReportsController::class, 'imprest']);
            Route::get('reports/procurement',     [\App\Http\Controllers\Api\V1\ReportsController::class, 'procurement']);
            Route::get('reports/salary-advances', [\App\Http\Controllers\Api\V1\ReportsController::class, 'salaryAdvances']);
            Route::get('reports/hr-timesheets',   [\App\Http\Controllers\Api\V1\ReportsController::class, 'hrTimesheets']);
            Route::get('reports/risk',            [\App\Http\Controllers\Api\V1\ReportsController::class, 'risk']);
            Route::get('reports/governance',      [\App\Http\Controllers\Api\V1\ReportsController::class, 'governance']);
        });

        // Asset categories (CRUD; same auth as asset create)
        Route::get('asset-categories', [\App\Http\Controllers\Api\V1\Assets\AssetCategoryController::class, 'index']);
        Route::post('asset-categories', [\App\Http\Controllers\Api\V1\Assets\AssetCategoryController::class, 'store']);
        Route::put('asset-categories/{assetCategory}', [\App\Http\Controllers\Api\V1\Assets\AssetCategoryController::class, 'update']);
        Route::delete('asset-categories/{assetCategory}', [\App\Http\Controllers\Api\V1\Assets\AssetCategoryController::class, 'destroy']);

        // Assets (inventory, fleet - filter by category or assigned_to=me; create gated by admin/manager)
        Route::get('assets/dashboard', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'dashboard']);
        Route::get('assets/register-export', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'registerExport']);
        Route::get('assets', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'index']);
        Route::post('assets', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'store']);
        Route::post('assets/{asset}/capitalise', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'capitalise']);
        Route::post('assets/{asset}/reject-capitalisation', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'rejectCapitalisation']);
        Route::post('assets/{asset}/assign', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'assign']);
        Route::post('assets/{asset}/acknowledge', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'acknowledge']);
        Route::post('assets/{asset}/transfer', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'transfer']);
        Route::post('assets/{asset}/return', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'returnAsset']);
        Route::post('assets/{asset}/mark-condition', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'markCondition']);
        Route::get('assets/{asset}/assignment-history', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'assignmentHistory']);
        Route::get('assets/{asset}', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'show']);
        Route::put('assets/{asset}', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'update']);
        Route::delete('assets/{asset}', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'destroy']);
        Route::get('assets/{asset}/qr', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'qr']);
        Route::post('assets/{asset}/invoice', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'uploadInvoice']);

        // Fleet ops layer on vehicle Fixed Assets (category=fleet)
        Route::prefix('fleet')->group(function () {
            $fleet = \App\Http\Controllers\Api\V1\Fleet\FleetController::class;
            Route::get('vehicles', [$fleet, 'index']);
            Route::get('vehicles/{asset}', [$fleet, 'show']);
            Route::post('vehicles/{asset}/trips', [$fleet, 'storeTrip']);
            Route::post('vehicles/{asset}/fuel-logs', [$fleet, 'storeFuelLog']);
            Route::post('vehicles/{asset}/service-schedules', [$fleet, 'storeServiceSchedule']);
        });

        // Asset lifecycle: locations, policies, verification, maintenance, depreciation
        Route::get('assets-meta/locations', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'locations']);
        Route::post('assets-meta/locations', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'storeLocation']);
        Route::get('assets-meta/capitalisation-policies', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'policies']);
        Route::post('assets-meta/capitalisation-policies', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'storePolicy']);
        Route::get('assets-meta/verification-campaigns', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'campaigns']);
        Route::post('assets-meta/verification-campaigns', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'storeCampaign']);
        Route::post('assets-meta/verification-campaigns/{assetVerificationCampaign}/results', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'recordVerification']);
        Route::post('assets-meta/verification-campaigns/{assetVerificationCampaign}/close', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'closeCampaign']);
        Route::get('assets-meta/maintenance', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'maintenanceIndex']);
        Route::post('assets-meta/maintenance', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'storeMaintenance']);
        Route::post('assets-meta/maintenance/{assetMaintenanceRecord}/complete', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'completeMaintenance']);
        Route::get('assets-meta/depreciation-runs', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'depreciationRuns']);
        Route::get('assets-meta/depreciation-runs/{assetDepreciationRun}', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'showDepreciationRun']);
        Route::post('assets-meta/depreciation-runs', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'runDepreciation']);
        Route::get('assets-meta/insurance/policies', [\App\Http\Controllers\Api\V1\Assets\AssetInsuranceController::class, 'indexPolicies']);
        Route::post('assets-meta/insurance/policies', [\App\Http\Controllers\Api\V1\Assets\AssetInsuranceController::class, 'storePolicy']);
        Route::put('assets-meta/insurance/policies/{policy}', [\App\Http\Controllers\Api\V1\Assets\AssetInsuranceController::class, 'updatePolicy']);
        Route::get('assets-meta/insurance/claims', [\App\Http\Controllers\Api\V1\Assets\AssetInsuranceController::class, 'indexClaims']);
        Route::post('assets-meta/insurance/claims', [\App\Http\Controllers\Api\V1\Assets\AssetInsuranceController::class, 'storeClaim']);
        Route::put('assets-meta/insurance/claims/{claim}', [\App\Http\Controllers\Api\V1\Assets\AssetInsuranceController::class, 'updateClaim']);

        // Disposal workflow
        Route::get('asset-disposals', [\App\Http\Controllers\Api\V1\Assets\AssetDisposalController::class, 'index']);
        Route::post('asset-disposals', [\App\Http\Controllers\Api\V1\Assets\AssetDisposalController::class, 'store']);
        Route::post('asset-disposals/{assetDisposal}/recommend', [\App\Http\Controllers\Api\V1\Assets\AssetDisposalController::class, 'recommend']);
        Route::post('asset-disposals/{assetDisposal}/finance-review', [\App\Http\Controllers\Api\V1\Assets\AssetDisposalController::class, 'financeReview']);
        Route::post('asset-disposals/{assetDisposal}/approve', [\App\Http\Controllers\Api\V1\Assets\AssetDisposalController::class, 'approve']);
        Route::post('asset-disposals/{assetDisposal}/complete', [\App\Http\Controllers\Api\V1\Assets\AssetDisposalController::class, 'complete']);

        // Asset Movements
        Route::get('assets/movements/list', [\App\Http\Controllers\Api\V1\Assets\AssetMovementController::class, 'index']);
        Route::post('assets/movements', [\App\Http\Controllers\Api\V1\Assets\AssetMovementController::class, 'store']);
        Route::get('assets/movements/{assetMovement}', [\App\Http\Controllers\Api\V1\Assets\AssetMovementController::class, 'show']);

        // Asset requests (any auth user can request; managers see all)
        Route::get('asset-requests', [\App\Http\Controllers\Api\V1\Assets\AssetRequestController::class, 'index']);
        Route::post('asset-requests', [\App\Http\Controllers\Api\V1\Assets\AssetRequestController::class, 'store']);
        Route::get('asset-requests/{assetRequest}', [\App\Http\Controllers\Api\V1\Assets\AssetRequestController::class, 'show']);
        Route::put('asset-requests/{assetRequest}', [\App\Http\Controllers\Api\V1\Assets\AssetRequestController::class, 'update']);
        Route::delete('asset-requests/{assetRequest}', [\App\Http\Controllers\Api\V1\Assets\AssetRequestController::class, 'destroy']);

        // ── Consumables / Stock Register (PRD §17, §27) ───────────────────────
        // SEPARATE from the Fixed Asset Register above. Read routes gated on
        // stock.view; write actions are gated by Form Request authorize() using
        // stock.create / stock.edit / stock.issue / stock.manage / stock.admin.
        Route::middleware('can:stock.view')->group(function () {
            Route::get('stock/dashboard', \App\Http\Controllers\Api\V1\Stock\StockDashboardController::class);

            // Stock categories (admin config — §27)
            Route::get('stock/categories', [\App\Http\Controllers\Api\V1\Stock\StockCategoryController::class, 'index']);
            Route::post('stock/categories', [\App\Http\Controllers\Api\V1\Stock\StockCategoryController::class, 'store']);
            Route::put('stock/categories/{stockCategory}', [\App\Http\Controllers\Api\V1\Stock\StockCategoryController::class, 'update']);
            Route::delete('stock/categories/{stockCategory}', [\App\Http\Controllers\Api\V1\Stock\StockCategoryController::class, 'destroy']);

            // Units of measure & store locations
            Route::get('stock/units', [\App\Http\Controllers\Api\V1\Stock\StockUnitController::class, 'index']);
            Route::post('stock/units', [\App\Http\Controllers\Api\V1\Stock\StockUnitController::class, 'store']);
            Route::put('stock/units/{stockUnit}', [\App\Http\Controllers\Api\V1\Stock\StockUnitController::class, 'update']);
            Route::delete('stock/units/{stockUnit}', [\App\Http\Controllers\Api\V1\Stock\StockUnitController::class, 'destroy']);

            Route::get('stock/locations', [\App\Http\Controllers\Api\V1\Stock\StockLocationController::class, 'index']);
            Route::post('stock/locations', [\App\Http\Controllers\Api\V1\Stock\StockLocationController::class, 'store']);
            Route::put('stock/locations/{stockLocation}', [\App\Http\Controllers\Api\V1\Stock\StockLocationController::class, 'update']);
            Route::delete('stock/locations/{stockLocation}', [\App\Http\Controllers\Api\V1\Stock\StockLocationController::class, 'destroy']);

            // Stocktakes / physical counts
            Route::get('stock/stocktakes', [\App\Http\Controllers\Api\V1\Stock\StocktakeController::class, 'index']);
            Route::post('stock/stocktakes', [\App\Http\Controllers\Api\V1\Stock\StocktakeController::class, 'store']);
            Route::get('stock/stocktakes/{stocktake}', [\App\Http\Controllers\Api\V1\Stock\StocktakeController::class, 'show']);
            Route::put('stock/stocktakes/{stocktake}/counts', [\App\Http\Controllers\Api\V1\Stock\StocktakeController::class, 'updateCounts']);
            Route::post('stock/stocktakes/{stocktake}/complete', [\App\Http\Controllers\Api\V1\Stock\StocktakeController::class, 'complete']);
            Route::post('stock/stocktakes/{stocktake}/approve-variances', [\App\Http\Controllers\Api\V1\Stock\StocktakeController::class, 'approveVariances']);
            Route::post('stock/stocktakes/{stocktake}/cancel', [\App\Http\Controllers\Api\V1\Stock\StocktakeController::class, 'cancel']);

            // Stock movements (in/out/adjustment) — declared before {stockItem} to avoid clashes
            Route::get('stock/transactions', [\App\Http\Controllers\Api\V1\Stock\StockTransactionController::class, 'index']);
            Route::post('stock/transactions', [\App\Http\Controllers\Api\V1\Stock\StockTransactionController::class, 'store']);
            Route::get('stock/transactions/{stockTransaction}', [\App\Http\Controllers\Api\V1\Stock\StockTransactionController::class, 'show']);

            // PRD Phase 1 stores workflows
            $stores = \App\Http\Controllers\Api\V1\Stock\StockStoresController::class;
            Route::match(['get', 'post'], 'stock/availability', [$stores, 'availability']);

            Route::get('stock/requests', [$stores, 'indexRequests']);
            Route::post('stock/requests', [$stores, 'storeRequest']);
            Route::get('stock/requests/{stockRequest}', [$stores, 'showRequest']);
            Route::post('stock/requests/{stockRequest}/submit', [$stores, 'submitRequest']);
            Route::post('stock/requests/{stockRequest}/approve', [$stores, 'approveRequest']);
            Route::post('stock/requests/{stockRequest}/reject', [$stores, 'rejectRequest']);
            Route::post('stock/requests/{stockRequest}/cancel', [$stores, 'cancelRequest']);

            Route::get('stock/issues', [$stores, 'indexIssues']);
            Route::post('stock/issues', [$stores, 'storeIssue']);
            Route::get('stock/issues/{stockIssue}', [$stores, 'showIssue']);
            Route::post('stock/issues/{stockIssue}/acknowledge', [$stores, 'acknowledgeIssue']);

            Route::get('stock/returns', [$stores, 'indexReturns']);
            Route::post('stock/returns', [$stores, 'storeReturn']);

            Route::get('stock/transfers', [$stores, 'indexTransfers']);
            Route::post('stock/transfers', [$stores, 'storeTransfer']);
            Route::get('stock/transfers/{stockTransfer}', [$stores, 'showTransfer']);
            Route::post('stock/transfers/{stockTransfer}/dispatch', [$stores, 'dispatchTransfer']);
            Route::post('stock/transfers/{stockTransfer}/receive', [$stores, 'receiveTransfer']);

            Route::get('stock/write-offs', [$stores, 'indexWriteOffs']);
            Route::post('stock/write-offs', [$stores, 'storeWriteOff']);
            Route::post('stock/write-offs/{stockWriteOff}/approve', [$stores, 'approveWriteOff']);

            Route::get('stock/replenishments', [$stores, 'indexReplenishments']);
            Route::post('stock/replenishments', [$stores, 'storeReplenishment']);

            Route::get('stock/batches', [$stores, 'indexBatches']);
            Route::post('stock/batches', [$stores, 'storeBatch']);
            Route::get('stock/demand-forecast', [$stores, 'demandForecast']);

            // Stock items (§17.2)
            Route::get('stock/items', [\App\Http\Controllers\Api\V1\Stock\StockItemController::class, 'index']);
            Route::post('stock/items', [\App\Http\Controllers\Api\V1\Stock\StockItemController::class, 'store']);
            Route::get('stock/items/{stockItem}', [\App\Http\Controllers\Api\V1\Stock\StockItemController::class, 'show']);
            Route::put('stock/items/{stockItem}', [\App\Http\Controllers\Api\V1\Stock\StockItemController::class, 'update']);
            Route::delete('stock/items/{stockItem}', [\App\Http\Controllers\Api\V1\Stock\StockItemController::class, 'destroy']);
            Route::post('stock/items/{stockItem}/quarantine', [$stores, 'quarantine']);
            Route::post('stock/items/{stockItem}/release-quarantine', [$stores, 'releaseQuarantine']);
        });

        // Assignments, Oversight & Accountability
        Route::prefix('assignments')->group(function () {
            Route::get('stats', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'stats']);
            Route::get('mine', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'mine']);
            Route::get('team', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'team']);
            Route::get('register', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'register']);
            Route::get('calendar', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'calendar']);
            Route::get('review-queue', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'reviewQueue']);
            Route::get('reports/summary', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'reportsSummary']);
            Route::get('weekly-summary-feed', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'weeklySummaryFeed']);
            Route::post('from-source', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'fromSource']);
            Route::post('templates', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'storeTemplate']);
            Route::apiResource('/', \App\Http\Controllers\Api\V1\Assignments\AssignmentController::class)
                ->parameter('', 'assignment')
                ->names('assignments');
            Route::post('{assignment}/issue',    [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'issue']);
            Route::post('{assignment}/accept',   [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'accept']);
            Route::post('{assignment}/claim',    [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'claim']);
            Route::post('{assignment}/start',    [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'start']);
            Route::post('{assignment}/updates',  [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'addUpdate']);
            Route::post('{assignment}/block',    [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'block']);
            Route::post('{assignment}/unblock',  [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'unblock']);
            Route::post('{assignment}/complete', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'complete']);
            Route::post('{assignment}/verify',   [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'verify']);
            Route::post('{assignment}/close',    [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'close']);
            Route::post('{assignment}/return',   [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'returnAssignment']);
            Route::post('{assignment}/cancel',   [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'cancel']);
            Route::post('{assignment}/reassign', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'reassign']);
            Route::post('{assignment}/change-due-date', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'changeDueDate']);
            Route::post('{assignment}/participants', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'addParticipant']);
            Route::post('{assignment}/checklist', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'addChecklistItem']);
            Route::post('{assignment}/checklist/{checklistItem}/toggle', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'toggleChecklistItem']);
            Route::post('{assignment}/subtasks', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'createSubtask']);
            Route::post('{assignment}/generate', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'generateFromTemplate']);
        });

        // Governance — committees & meeting-type config
        Route::get('governance/committees', [\App\Http\Controllers\Api\V1\Governance\CommitteeController::class, 'indexCommittees']);
        Route::post('governance/committees', [\App\Http\Controllers\Api\V1\Governance\CommitteeController::class, 'storeCommittee']);
        Route::put('governance/committees/{committee}', [\App\Http\Controllers\Api\V1\Governance\CommitteeController::class, 'updateCommittee']);
        Route::delete('governance/committees/{committee}', [\App\Http\Controllers\Api\V1\Governance\CommitteeController::class, 'destroyCommittee']);
        Route::get('governance/meeting-types', [\App\Http\Controllers\Api\V1\Governance\CommitteeController::class, 'indexMeetingTypes']);
        Route::post('governance/meeting-types', [\App\Http\Controllers\Api\V1\Governance\CommitteeController::class, 'storeMeetingType']);
        Route::put('governance/meeting-types/{meetingType}', [\App\Http\Controllers\Api\V1\Governance\CommitteeController::class, 'updateMeetingType']);
        Route::delete('governance/meeting-types/{meetingType}', [\App\Http\Controllers\Api\V1\Governance\CommitteeController::class, 'destroyMeetingType']);

        // Governance (meetings from workplan, resolutions + multilingual documents)
        Route::get('governance/meetings', [\App\Http\Controllers\Api\V1\Governance\GovernanceController::class, 'meetings']);
        Route::get('governance/resolutions', [\App\Http\Controllers\Api\V1\Governance\GovernanceController::class, 'resolutions']);
        Route::post('governance/resolutions', [\App\Http\Controllers\Api\V1\Governance\GovernanceController::class, 'storeResolution']);
        Route::get('governance/resolutions/{resolution}', [\App\Http\Controllers\Api\V1\Governance\GovernanceController::class, 'showResolution']);
        Route::put('governance/resolutions/{resolution}', [\App\Http\Controllers\Api\V1\Governance\GovernanceController::class, 'updateResolution']);
        Route::delete('governance/resolutions/{resolution}', [\App\Http\Controllers\Api\V1\Governance\GovernanceController::class, 'destroyResolution']);
        Route::post('governance/resolutions/{resolution}/documents', [\App\Http\Controllers\Api\V1\Governance\GovernanceController::class, 'uploadDocument']);
        Route::delete('governance/resolutions/{resolution}/documents/{attachment}', [\App\Http\Controllers\Api\V1\Governance\GovernanceController::class, 'deleteDocument']);
        Route::get('governance/resolutions/{resolution}/documents/{attachment}/download', [\App\Http\Controllers\Api\V1\Governance\GovernanceController::class, 'downloadDocument']);

        // Meeting Minutes (staff meetings, action items, task assignment)
        Route::get('governance/minutes', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'index']);
        Route::post('governance/minutes', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'store']);
        Route::get('governance/minutes/{meetingMinute}', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'show']);
        Route::put('governance/minutes/{meetingMinute}', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'update']);
        Route::delete('governance/minutes/{meetingMinute}', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'destroy']);
        Route::post('governance/minutes/{meetingMinute}/documents', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'uploadDocument']);
        Route::delete('governance/minutes/{meetingMinute}/documents/{attachment}', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'deleteDocument']);
        Route::get('governance/minutes/{meetingMinute}/documents/{attachment}/download', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'downloadDocument']);
        Route::post('governance/minutes/{meetingMinute}/action-items', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'addActionItem']);
        Route::put('governance/minutes/{meetingMinute}/action-items/{actionItem}', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'updateActionItem']);
        Route::delete('governance/minutes/{meetingMinute}/action-items/{actionItem}', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'deleteActionItem']);
        Route::post('governance/minutes/{meetingMinute}/action-items/{actionItem}/assign', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'assignActionItem']);

        // Meeting Resolutions / Decision Register (Phase 1 + Phase 3)
        Route::prefix('decisions')->group(function () {
            Route::get('dashboard', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'dashboard']);
            Route::get('owners', [\App\Http\Controllers\Api\V1\Decisions\MeetingAgendaController::class, 'ownerOptions']);
            Route::get('minutes-options', [\App\Http\Controllers\Api\V1\Decisions\MeetingAgendaController::class, 'minutesOptions']);
            Route::get('agenda-items', [\App\Http\Controllers\Api\V1\Decisions\MeetingAgendaController::class, 'index']);
            Route::post('agenda-items', [\App\Http\Controllers\Api\V1\Decisions\MeetingAgendaController::class, 'store']);
            Route::post('agenda-items/{agendaItem}/link-decision', [\App\Http\Controllers\Api\V1\Decisions\MeetingAgendaController::class, 'linkDecision']);
            Route::post('promote-weekly-assignments', [\App\Http\Controllers\Api\V1\Decisions\MeetingAgendaController::class, 'promoteWeekly']);
            Route::get('/', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'index']);
            Route::post('/', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'store']);
            Route::get('{decision}', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'show']);
            Route::put('{decision}', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'update']);
            Route::delete('{decision}', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'destroy']);
            Route::post('{decision}/adopt', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'adopt']);
            Route::post('{decision}/start-progress', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'startProgress']);
            Route::post('{decision}/mark-implemented', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'markImplemented']);
            Route::post('{decision}/close', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'close']);
            Route::post('{decision}/supersede', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'supersede']);
            Route::get('{decision}/history', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'history']);
            Route::post('{decision}/create-assignment', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'createAssignment']);
            Route::get('{decision}/actions', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'listActions']);
            Route::post('{decision}/actions', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'storeAction']);
            Route::put('{decision}/actions/{action}', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'updateAction']);
            Route::post('{decision}/actions/{action}/create-assignment', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'createActionAssignment']);
        });

        // Correspondence & Registry (ICRMS) — Phase 1 Register
        Route::prefix('correspondence')->group(function () {
            $letters = \App\Http\Controllers\Api\V1\Correspondence\CorrespondenceController::class;
            $register = \App\Http\Controllers\Api\V1\Correspondence\CorrespondenceRegisterController::class;

            Route::get('letters', [$letters, 'index']);
            Route::post('letters', [$letters, 'store']);
            Route::post('letters/incoming/register', [$register, 'registerIncoming']);
            Route::get('letters/{correspondence}', [$letters, 'show']);
            Route::put('letters/{correspondence}', [$letters, 'update']);
            Route::delete('letters/{correspondence}', [$letters, 'destroy']);
            Route::post('letters/{correspondence}/submit', [$letters, 'submit']);
            Route::post('letters/{correspondence}/review', [$letters, 'review']);
            Route::post('letters/{correspondence}/approve', [$letters, 'approve']);
            Route::post('letters/{correspondence}/send', [$letters, 'send']);
            Route::get('letters/{correspondence}/download', [$letters, 'download']);

            Route::post('letters/{correspondence}/sg-route', [$register, 'sgRoute']);
            Route::post('letters/{correspondence}/acknowledge', [$register, 'acknowledge']);
            Route::get('letters/{correspondence}/notes', [$register, 'notes']);
            Route::post('letters/{correspondence}/notes', [$register, 'addNote']);
            Route::post('letters/{correspondence}/relationships', [$register, 'linkRelationship']);
            Route::post('letters/{correspondence}/sign', [$register, 'sign']);
            Route::post('letters/{correspondence}/dispatch', [$register, 'dispatchItem']);
            Route::post('letters/{correspondence}/void-reference', [$register, 'voidReference']);
            Route::post('letters/{correspondence}/assignments', [$register, 'linkAssignment']);
            Route::post('letters/{correspondence}/subject-files', [$register, 'linkSubjectFile']);

            Route::patch('dispatches/{dispatch}/delivery', [$register, 'updateDelivery']);

            Route::get('subject-files', [$register, 'subjectFiles']);
            Route::post('subject-files', [$register, 'storeSubjectFile']);
            Route::get('master-register', [$register, 'masterRegister']);
            Route::get('my-actions', [$register, 'myActions']);
            Route::get('reports/summary', [$register, 'reportSummary']);
            Route::get('settings/numbering', [$register, 'numberingPolicy']);
            Route::put('settings/numbering', [$register, 'updateNumberingPolicy']);

            $mailbox = \App\Http\Controllers\Api\V1\Correspondence\CorrespondenceMailboxController::class;
            Route::get('mailbox/settings', [$mailbox, 'settings']);
            Route::put('mailbox/settings', [$mailbox, 'updateSettings']);
            Route::get('mailbox/suggestions', [$mailbox, 'indexSuggestions']);
            Route::post('mailbox/suggestions/import', [$mailbox, 'importSuggestion']);
            Route::post('mailbox/suggestions/{suggestion}/register', [$mailbox, 'registerSuggestion']);
            Route::post('mailbox/suggestions/{suggestion}/dismiss', [$mailbox, 'dismissSuggestion']);

            Route::get('contacts', [\App\Http\Controllers\Api\V1\Correspondence\CorrespondenceContactController::class, 'index']);
            Route::post('contacts', [\App\Http\Controllers\Api\V1\Correspondence\CorrespondenceContactController::class, 'store']);
            Route::get('contacts/{contact}', [\App\Http\Controllers\Api\V1\Correspondence\CorrespondenceContactController::class, 'show']);
            Route::put('contacts/{contact}', [\App\Http\Controllers\Api\V1\Correspondence\CorrespondenceContactController::class, 'update']);
            Route::delete('contacts/{contact}', [\App\Http\Controllers\Api\V1\Correspondence\CorrespondenceContactController::class, 'destroy']);

            Route::get('groups', [\App\Http\Controllers\Api\V1\Correspondence\ContactGroupController::class, 'index']);
            Route::post('groups', [\App\Http\Controllers\Api\V1\Correspondence\ContactGroupController::class, 'store']);
            Route::get('groups/{group}', [\App\Http\Controllers\Api\V1\Correspondence\ContactGroupController::class, 'show']);
            Route::put('groups/{group}', [\App\Http\Controllers\Api\V1\Correspondence\ContactGroupController::class, 'update']);
            Route::delete('groups/{group}', [\App\Http\Controllers\Api\V1\Correspondence\ContactGroupController::class, 'destroy']);
            Route::post('groups/{group}/members', [\App\Http\Controllers\Api\V1\Correspondence\ContactGroupController::class, 'addMembers']);
            Route::delete('groups/{group}/members', [\App\Http\Controllers\Api\V1\Correspondence\ContactGroupController::class, 'removeMembers']);
        });

        // Support tickets
        Route::get('support/tickets', [\App\Http\Controllers\Api\V1\Support\SupportTicketController::class, 'index']);
        Route::post('support/tickets', [\App\Http\Controllers\Api\V1\Support\SupportTicketController::class, 'store']);
        Route::get('support/tickets/{supportTicket}', [\App\Http\Controllers\Api\V1\Support\SupportTicketController::class, 'show']);
        Route::put('support/tickets/{supportTicket}', [\App\Http\Controllers\Api\V1\Support\SupportTicketController::class, 'update']);
        Route::delete('support/tickets/{supportTicket}', [\App\Http\Controllers\Api\V1\Support\SupportTicketController::class, 'destroy']);

        // Alerts
        Route::get('alerts/summary', [\App\Http\Controllers\Api\V1\Alerts\AlertsController::class, 'summary']);

        // Approval Workflows
        Route::prefix('approvals')->group(function () {
            Route::get('pending', [\App\Http\Controllers\Api\V1\ApprovalController::class, 'pending']);
            Route::post('{approvalRequest}/approve', [\App\Http\Controllers\Api\V1\ApprovalController::class, 'approve']);
            Route::post('{approvalRequest}/reject', [\App\Http\Controllers\Api\V1\ApprovalController::class, 'reject']);
            Route::get('{approvalRequest}/history', [\App\Http\Controllers\Api\V1\ApprovalController::class, 'history']);
            Route::get('{approvalRequest}/snapshot', [\App\Http\Controllers\Api\V1\ApprovalController::class, 'snapshot']);
        });

        // SAAM — Signature & Approval Authentication Module
        Route::prefix('saam')->group(function () {
            Route::get('profile', [\App\Http\Controllers\Api\V1\Saam\SignatureProfileController::class, 'show']);
            Route::post('profile/draw', [\App\Http\Controllers\Api\V1\Saam\SignatureProfileController::class, 'draw']);
            Route::post('profile/upload', [\App\Http\Controllers\Api\V1\Saam\SignatureProfileController::class, 'upload']);
            Route::delete('profile/{type}', [\App\Http\Controllers\Api\V1\Saam\SignatureProfileController::class, 'revoke']);

            Route::get('signature-image/{signatureVersion}', [\App\Http\Controllers\Api\V1\Saam\SignatureImageController::class, 'show'])
                ->name('saam.signature-image');

            Route::post('sign/{signable_type}/{signable_id}', [\App\Http\Controllers\Api\V1\Saam\SignatureEventController::class, 'store']);
            Route::get('events/{signable_type}/{signable_id}', [\App\Http\Controllers\Api\V1\Saam\SignatureEventController::class, 'index']);
            Route::get('my-events', [\App\Http\Controllers\Api\V1\Saam\SignatureEventController::class, 'myEvents']);

            Route::get('delegations', [\App\Http\Controllers\Api\V1\Saam\DelegationController::class, 'index']);
            Route::post('delegations', [\App\Http\Controllers\Api\V1\Saam\DelegationController::class, 'store']);
            Route::delete('delegations/{delegation}', [\App\Http\Controllers\Api\V1\Saam\DelegationController::class, 'destroy']);

            Route::post('documents/generate/{signable_type}/{signable_id}', [\App\Http\Controllers\Api\V1\Saam\SignedDocumentController::class, 'generate']);
            Route::get('documents/{signable_type}/{signable_id}', [\App\Http\Controllers\Api\V1\Saam\SignedDocumentController::class, 'show']);
            Route::get('documents/download/{document}', [\App\Http\Controllers\Api\V1\Saam\SignedDocumentController::class, 'download']);
        });

        // SRHR — Field Researcher Deployment & Reporting Module
        Route::prefix('srhr')->group(function () {
            // Parliaments
            Route::get('parliaments', [\App\Http\Controllers\Api\V1\Srhr\ParliamentController::class, 'index']);
            Route::post('parliaments', [\App\Http\Controllers\Api\V1\Srhr\ParliamentController::class, 'store']);
            Route::get('parliaments/{parliament}', [\App\Http\Controllers\Api\V1\Srhr\ParliamentController::class, 'show']);
            Route::put('parliaments/{parliament}', [\App\Http\Controllers\Api\V1\Srhr\ParliamentController::class, 'update']);
            Route::delete('parliaments/{parliament}', [\App\Http\Controllers\Api\V1\Srhr\ParliamentController::class, 'destroy']);

            // Staff Deployments
            Route::get('deployments', [\App\Http\Controllers\Api\V1\Srhr\StaffDeploymentController::class, 'index']);
            Route::post('deployments', [\App\Http\Controllers\Api\V1\Srhr\StaffDeploymentController::class, 'store']);
            Route::get('deployments/{staffDeployment}', [\App\Http\Controllers\Api\V1\Srhr\StaffDeploymentController::class, 'show']);
            Route::put('deployments/{staffDeployment}', [\App\Http\Controllers\Api\V1\Srhr\StaffDeploymentController::class, 'update']);
            Route::delete('deployments/{staffDeployment}', [\App\Http\Controllers\Api\V1\Srhr\StaffDeploymentController::class, 'destroy']);
            Route::post('deployments/{staffDeployment}/recall', [\App\Http\Controllers\Api\V1\Srhr\StaffDeploymentController::class, 'recall']);
            Route::post('deployments/{staffDeployment}/complete', [\App\Http\Controllers\Api\V1\Srhr\StaffDeploymentController::class, 'complete']);

            // Researcher Reports
            Route::get('reports', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportController::class, 'index']);
            Route::post('reports', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportController::class, 'store']);
            Route::get('reports/{researcherReport}', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportController::class, 'show']);
            Route::put('reports/{researcherReport}', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportController::class, 'update']);
            Route::delete('reports/{researcherReport}', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportController::class, 'destroy']);
            Route::post('reports/{researcherReport}/submit', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportController::class, 'submit']);
            Route::post('reports/{researcherReport}/acknowledge', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportController::class, 'acknowledge']);
            Route::post('reports/{researcherReport}/request-revision', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportController::class, 'requestRevision']);

            // Report Attachments
            Route::get('reports/{researcherReport}/attachments', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportAttachmentController::class, 'index']);
            Route::post('reports/{researcherReport}/attachments', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportAttachmentController::class, 'store']);
            Route::delete('reports/{researcherReport}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportAttachmentController::class, 'destroy']);
            Route::get('reports/{researcherReport}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportAttachmentController::class, 'download']);
        });

        // Risk Register Module
        Route::prefix('risk')->group(function () {
            Route::get('dashboard',   [\App\Http\Controllers\Api\V1\Risk\RiskDashboardController::class, 'summary']);
            Route::get('audit-trail', [\App\Http\Controllers\Api\V1\Risk\RiskController::class, 'auditTrail']);
            Route::get('matrix',      [\App\Http\Controllers\Api\V1\Risk\RiskMatrixController::class, 'matrix']);

            // Phase 2 — automated KRIs
            Route::get('kris/catalog', [\App\Http\Controllers\Api\V1\Risk\RiskKriController::class, 'catalog']);
            Route::get('kris', [\App\Http\Controllers\Api\V1\Risk\RiskKriController::class, 'index']);
            Route::post('kris/evaluate', [\App\Http\Controllers\Api\V1\Risk\RiskKriController::class, 'evaluate']);
            Route::patch('kris/{kri}', [\App\Http\Controllers\Api\V1\Risk\RiskKriController::class, 'update']);

            // Phase 3 — control testing, BCP/insurance, interdependencies
            Route::get('control-testing/campaigns', [\App\Http\Controllers\Api\V1\Risk\RiskPhase3Controller::class, 'listCampaigns']);
            Route::post('control-testing/campaigns', [\App\Http\Controllers\Api\V1\Risk\RiskPhase3Controller::class, 'storeCampaign']);
            Route::get('control-testing/campaigns/{campaign}', [\App\Http\Controllers\Api\V1\Risk\RiskPhase3Controller::class, 'showCampaign']);
            Route::post('control-testing/items/{item}/complete', [\App\Http\Controllers\Api\V1\Risk\RiskPhase3Controller::class, 'completeItem']);
            Route::post('control-testing/mark-overdue', [\App\Http\Controllers\Api\V1\Risk\RiskPhase3Controller::class, 'markOverdue']);
            Route::get('bcp-links', [\App\Http\Controllers\Api\V1\Risk\RiskPhase3Controller::class, 'listBcpLinks']);
            Route::post('bcp-links', [\App\Http\Controllers\Api\V1\Risk\RiskPhase3Controller::class, 'storeBcpLink']);
            Route::get('dependencies', [\App\Http\Controllers\Api\V1\Risk\RiskPhase3Controller::class, 'listDependencies']);
            Route::post('dependencies', [\App\Http\Controllers\Api\V1\Risk\RiskPhase3Controller::class, 'storeDependency']);

            Route::apiResource('risks', \App\Http\Controllers\Api\V1\Risk\RiskController::class);
            Route::post('risks/{risk}/submit',       [\App\Http\Controllers\Api\V1\Risk\RiskController::class, 'submit']);
            Route::post('risks/{risk}/start-review', [\App\Http\Controllers\Api\V1\Risk\RiskController::class, 'startReview']);
            Route::post('risks/{risk}/approve',      [\App\Http\Controllers\Api\V1\Risk\RiskController::class, 'approve']);
            Route::post('risks/{risk}/escalate',     [\App\Http\Controllers\Api\V1\Risk\RiskController::class, 'escalate']);
            Route::post('risks/{risk}/close',        [\App\Http\Controllers\Api\V1\Risk\RiskController::class, 'close']);
            Route::post('risks/{risk}/archive',      [\App\Http\Controllers\Api\V1\Risk\RiskController::class, 'archive']);
            Route::post('risks/{risk}/reopen',       [\App\Http\Controllers\Api\V1\Risk\RiskController::class, 'reopen']);
            Route::get('risks/{risk}/logs',          [\App\Http\Controllers\Api\V1\Risk\RiskController::class, 'logs']);

            Route::get('risks/{risk}/actions',                    [\App\Http\Controllers\Api\V1\Risk\RiskActionController::class, 'index']);
            Route::post('risks/{risk}/actions',                   [\App\Http\Controllers\Api\V1\Risk\RiskActionController::class, 'store']);
            Route::put('risks/{risk}/actions/{action}',           [\App\Http\Controllers\Api\V1\Risk\RiskActionController::class, 'update']);
            Route::post('risks/{risk}/actions/{action}/complete', [\App\Http\Controllers\Api\V1\Risk\RiskActionController::class, 'markComplete']);
            Route::post('risks/{risk}/actions/{action}/create-assignment', [\App\Http\Controllers\Api\V1\Risk\RiskActionController::class, 'createAssignment']);
            Route::delete('risks/{risk}/actions/{action}',        [\App\Http\Controllers\Api\V1\Risk\RiskActionController::class, 'destroy']);

            // Phase 1 extensions
            Route::get('risks/{risk}/assessments', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'listAssessments']);
            Route::post('risks/{risk}/assessments', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'storeAssessment']);
            Route::post('risks/{risk}/acceptances', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'requestAcceptance']);
            Route::post('acceptances/{acceptance}/decide', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'decideAcceptance']);
            Route::post('risks/{risk}/materialise', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'materialise']);
            Route::post('risks/{risk}/accept-proposal', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'acceptProposal']);
            Route::post('risks/{risk}/reject-proposal', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'rejectProposal']);
            Route::post('controls', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'storeControl']);
            Route::post('risks/{risk}/controls', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'linkControl']);
            Route::get('incidents', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'listIncidents']);
            Route::post('incidents', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'storeIncident']);
            Route::get('appetite-policies', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'appetiteIndex']);
            Route::post('appetite-policies', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'appetiteStore']);
            Route::post('appetite-policies/{policy}/activate', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'appetiteActivate']);

            // Risk Attachments
            Route::get('risks/{risk}/attachments',                            [\App\Http\Controllers\Api\V1\Risk\RiskAttachmentController::class, 'index']);
            Route::post('risks/{risk}/attachments',                           [\App\Http\Controllers\Api\V1\Risk\RiskAttachmentController::class, 'store']);
            Route::delete('risks/{risk}/attachments/{attachment}',            [\App\Http\Controllers\Api\V1\Risk\RiskAttachmentController::class, 'destroy']);
            Route::get('risks/{risk}/attachments/{attachment}/download',      [\App\Http\Controllers\Api\V1\Risk\RiskAttachmentController::class, 'download']);

            // Policy Library
            Route::apiResource('policies', \App\Http\Controllers\Api\V1\Risk\PolicyController::class);
            Route::get('risks/{risk}/policies',                               [\App\Http\Controllers\Api\V1\Risk\PolicyController::class, 'listForRisk']);
            Route::post('policies/{policy}/attach-risk',                      [\App\Http\Controllers\Api\V1\Risk\PolicyController::class, 'attachToRisk']);
            Route::delete('policies/{policy}/detach-risk/{risk}',             [\App\Http\Controllers\Api\V1\Risk\PolicyController::class, 'detachFromRisk']);

            // Policy Attachments
            Route::get('policies/{policy}/attachments',                       [\App\Http\Controllers\Api\V1\Risk\PolicyAttachmentController::class, 'index']);
            Route::post('policies/{policy}/attachments',                      [\App\Http\Controllers\Api\V1\Risk\PolicyAttachmentController::class, 'store']);
            Route::delete('policies/{policy}/attachments/{attachment}',       [\App\Http\Controllers\Api\V1\Risk\PolicyAttachmentController::class, 'destroy']);
            Route::get('policies/{policy}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Risk\PolicyAttachmentController::class, 'download']);
        });

        // Weekly Summary (email digest — existing)
        Route::prefix('weekly-summary')->group(function () {
            Route::get('preferences/me',  [\App\Http\Controllers\Api\V1\WeeklySummary\WeeklySummaryController::class, 'getPreferences']);
            Route::put('preferences/me',  [\App\Http\Controllers\Api\V1\WeeklySummary\WeeklySummaryController::class, 'updatePreferences']);
            Route::get('reports',         [\App\Http\Controllers\Api\V1\WeeklySummary\WeeklySummaryController::class, 'listReports']);
            Route::get('reports/{report}',[\App\Http\Controllers\Api\V1\WeeklySummary\WeeklySummaryController::class, 'showReport']);
        });

        Route::prefix('admin/weekly-summary')->middleware('role:System Admin')->group(function () {
            Route::get('runs',  [\App\Http\Controllers\Api\V1\WeeklySummary\WeeklySummaryController::class, 'listRuns']);
            Route::post('run',  [\App\Http\Controllers\Api\V1\WeeklySummary\WeeklySummaryController::class, 'triggerRun']);
        });

        // Weekly Summary Reports (operational progress reporting — PRD Phase 1)
        Route::prefix('weekly-summaries')->group(function () {
            Route::get('dashboard', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'dashboard']);
            Route::get('periods', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'periods']);
            Route::post('periods', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'storePeriod']);
            Route::get('current', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'current']);
            Route::get('current/suggestions', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'suggestions']);
            Route::post('/', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'store']);
            Route::post('department', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'department']);
            Route::post('institutional', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'institutional']);
            Route::post('exemptions', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'exemptions']);
            Route::get('{weeklySummary}', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'show']);
            Route::put('{weeklySummary}', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'update']);
            Route::post('{weeklySummary}/items', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'storeItem']);
            Route::post('{weeklySummary}/submit', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'submit']);
            Route::post('{weeklySummary}/return', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'returnReport']);
            Route::post('{weeklySummary}/accept', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'accept']);
            Route::post('{weeklySummary}/reopen', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'reopen']);
            Route::post('{weeklySummary}/include-suggestion', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'includeSuggestion']);
            Route::post('{weeklySummary}/exclude-suggestion', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'excludeSuggestion']);
            Route::post('{weeklySummary}/ai-draft', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'generateAiDraft']);
            Route::post('{weeklySummary}/ai-draft/confirm', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'confirmAiDraft']);
            Route::post('{weeklySummary}/consolidate-item', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'consolidateItem']);
            Route::post('{weeklySummary}/publish', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'publish']);
            Route::post('{weeklySummary}/extend-deadline', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'extendDeadline']);
            Route::get('{weeklySummary}/export/{format}', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'export']);
        });
        Route::post('weekly-summary-items/{weeklySummaryItem}/create-assignment', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'createAssignmentFromItem']);
        Route::post('weekly-summary-items/{weeklySummaryItem}/record-decision', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'recordDecision'])
            ->whereNumber('weeklySummaryItem');
        Route::post('weekly-summary-items/{weeklySummaryItem}/carry-forward', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'carryForward']);
        Route::post('weekly-report-risks/{weeklyReportRisk}/create-risk', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'createRiskFromWeekly']);

        // Admin Workflows
        Route::prefix('admin/workflows')->group(function () {
             Route::get('/', [\App\Http\Controllers\Api\V1\Admin\WorkflowAdminController::class, 'index']);
             Route::post('/', [\App\Http\Controllers\Api\V1\Admin\WorkflowAdminController::class, 'store']);
             Route::put('{workflow}', [\App\Http\Controllers\Api\V1\Admin\WorkflowAdminController::class, 'update']);
             Route::delete('{workflow}', [\App\Http\Controllers\Api\V1\Admin\WorkflowAdminController::class, 'destroy']);
        });
    });
});
