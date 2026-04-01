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
        Route::post('login', [AuthController::class, 'login'])->middleware('throttle:5,1');
    });

    // Email action preview — unauthenticated (token is the access control)
    Route::get('email-action/preview/{token}',
        [\App\Http\Controllers\Api\V1\EmailAction\EmailActionController::class, 'preview']
    )->middleware('throttle:20,1');

    // Authenticated routes
    Route::middleware(['auth:sanctum', 'throttle:60,1', \App\Http\Middleware\SetRlsContext::class])->group(function () {

        // External Integrations APIs (authenticated — requires valid Bearer token)
        Route::prefix('external')->group(function () {
            Route::get('workplan', [\App\Http\Controllers\Api\V1\Workplan\WorkplanExternalController::class, 'index']);
        });

        Route::prefix('auth')->group(function () {
            Route::post('logout', [AuthController::class, 'logout']);
            Route::get('me', [AuthController::class, 'me']);
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

        // Admin - User Management (tighter rate limit for sensitive operations)
        Route::prefix('admin')->middleware('throttle:20,1')->group(function () {
            // Users
            Route::apiResource('users', \App\Http\Controllers\Api\V1\Admin\UsersController::class);
            Route::post('users/{user}/reactivate', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'reactivate']);
            Route::post('users/{user}/change-password', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'changePassword']);
            Route::get('users/{user}/audit', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'audit']);

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

            // Payslips (list, show, download, upload, delete)
            Route::get('payslips', [\App\Http\Controllers\Api\V1\Admin\PayslipController::class, 'index']);
            Route::post('payslips', [\App\Http\Controllers\Api\V1\Admin\PayslipController::class, 'store']);
            Route::get('payslips/{payslip}', [\App\Http\Controllers\Api\V1\Admin\PayslipController::class, 'show']);
            Route::get('payslips/{payslip}/download', [\App\Http\Controllers\Api\V1\Admin\PayslipController::class, 'download']);
            Route::delete('payslips/{payslip}', [\App\Http\Controllers\Api\V1\Admin\PayslipController::class, 'destroy']);

            // Timesheet projects (admin CRUD)
            Route::get('timesheet-projects', [\App\Http\Controllers\Api\V1\Admin\TimesheetProjectController::class, 'index']);
            Route::post('timesheet-projects', [\App\Http\Controllers\Api\V1\Admin\TimesheetProjectController::class, 'store']);
            Route::put('timesheet-projects/{timesheet_project}', [\App\Http\Controllers\Api\V1\Admin\TimesheetProjectController::class, 'update']);
            Route::delete('timesheet-projects/{timesheet_project}', [\App\Http\Controllers\Api\V1\Admin\TimesheetProjectController::class, 'destroy']);

            // Audit Logs
            Route::get('audit-logs', [\App\Http\Controllers\Api\V1\Admin\AuditLogController::class, 'index']);

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
            Route::apiResource('requests', \App\Http\Controllers\Api\V1\Travel\TravelController::class)
                ->parameters(['requests' => 'travelRequest'])
                ->names('travel.requests');
            Route::post('requests/{travelRequest}/submit', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'submit']);
            Route::post('requests/{travelRequest}/approve', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'approve']);
            Route::post('requests/{travelRequest}/reject', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'reject']);
        });

        // Imprest Module
        Route::prefix('imprest')->group(function () {
            Route::apiResource('requests', \App\Http\Controllers\Api\V1\Imprest\ImprestController::class)
                ->parameters(['requests' => 'imprestRequest'])
                ->names('imprest.requests');
            Route::post('requests/{imprestRequest}/submit', [\App\Http\Controllers\Api\V1\Imprest\ImprestController::class, 'submit']);
            Route::post('requests/{imprestRequest}/approve', [\App\Http\Controllers\Api\V1\Imprest\ImprestController::class, 'approve']);
            Route::post('requests/{imprestRequest}/reject', [\App\Http\Controllers\Api\V1\Imprest\ImprestController::class, 'reject']);
            Route::post('requests/{imprestRequest}/retire', [\App\Http\Controllers\Api\V1\Imprest\ImprestController::class, 'retire']);
        });

        // Leave Module
        Route::prefix('leave')->group(function () {
            Route::get('balances', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'balances']);
            Route::get('lil-accruals', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'lilAccruals']);
            Route::apiResource('requests', \App\Http\Controllers\Api\V1\Leave\LeaveController::class)
                ->parameters(['requests' => 'leaveRequest'])
                ->names('leave.requests');
            Route::post('requests/{leaveRequest}/submit', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'submit']);
            Route::post('requests/{leaveRequest}/approve', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'approve']);
            Route::post('requests/{leaveRequest}/reject', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'reject']);
        });

        // Procurement Module
        Route::prefix('procurement')->group(function () {
            Route::apiResource('requests', \App\Http\Controllers\Api\V1\Procurement\ProcurementController::class)
                ->parameters(['requests' => 'procurementRequest'])
                ->names('procurement.requests');
            Route::post('requests/{procurementRequest}/submit', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'submit']);
            Route::post('requests/{procurementRequest}/approve', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'approve']);
            Route::post('requests/{procurementRequest}/reject', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'reject']);
            Route::post('requests/{procurementRequest}/award', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'award']);

            // Vendors
            Route::apiResource('vendors', \App\Http\Controllers\Api\V1\Procurement\VendorController::class)
                ->names('procurement.vendors');
            Route::post('vendors/{vendor}/approve', [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'approve']);
            Route::post('vendors/{vendor}/reject',  [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'reject']);
        });

        // Finance - Salary Advances, Payslips, Summary, and Budgets
        Route::prefix('finance')->group(function () {
            Route::apiResource('budgets', \App\Http\Controllers\Api\V1\Finance\BudgetController::class);
            Route::get('summary', [\App\Http\Controllers\Api\V1\Finance\FinanceSummaryController::class, 'summary']);
            Route::get('payslips', [\App\Http\Controllers\Api\V1\Finance\PayslipController::class, 'index']);
            Route::get('payslips/{payslip}', [\App\Http\Controllers\Api\V1\Finance\PayslipController::class, 'show']);
            Route::get('payslips/{payslip}/download', [\App\Http\Controllers\Api\V1\Finance\PayslipController::class, 'download']);
            Route::get('advances', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'index']);
            Route::get('advances/{salaryAdvanceRequest}', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'show']);
            Route::post('advances', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'store']);
            Route::put('advances/{salaryAdvanceRequest}', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'update']);
            Route::delete('advances/{salaryAdvanceRequest}', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'destroy']);
            Route::post('advances/{salaryAdvanceRequest}/submit', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'submit']);
            Route::post('advances/{salaryAdvanceRequest}/approve', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'approve']);
            Route::post('advances/{salaryAdvanceRequest}/reject', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'reject']);
        });

        // HR - Timesheets & Summary
        Route::prefix('hr')->group(function () {
            Route::get('summary', [\App\Http\Controllers\Api\V1\Hr\HrSummaryController::class, 'summary']);

            // Profile Change Approval (HR)
            Route::get('profile-requests', [\App\Http\Controllers\Api\V1\Hr\ProfileRequestController::class, 'index']);
            Route::get('profile-requests/{profileChangeRequest}', [\App\Http\Controllers\Api\V1\Hr\ProfileRequestController::class, 'show']);
            Route::post('profile-requests/{profileChangeRequest}/approve', [\App\Http\Controllers\Api\V1\Hr\ProfileRequestController::class, 'approve']);
            Route::post('profile-requests/{profileChangeRequest}/reject', [\App\Http\Controllers\Api\V1\Hr\ProfileRequestController::class, 'reject']);
            Route::get('timesheets', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'index']);
            Route::post('timesheets/import', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'import']);
            Route::get('timesheets/team', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'team']);
            Route::get('timesheets/leave-days', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'leaveDays']);
            Route::get('timesheets/{timesheet}', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'show']);
            Route::post('timesheets', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'store']);
            Route::put('timesheets/{timesheet}', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'update']);
            Route::post('timesheets/{timesheet}/submit', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'submit']);
            Route::post('timesheets/{timesheet}/approve', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'approve']);
            Route::post('timesheets/{timesheet}/reject', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'reject']);
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

            Route::get('{programme}/attachments', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeAttachmentController::class, 'index']);
            Route::post('{programme}/attachments', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeAttachmentController::class, 'store']);
            Route::put('{programme}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeAttachmentController::class, 'update']);
            Route::delete('{programme}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeAttachmentController::class, 'destroy']);
            Route::get('{programme}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeAttachmentController::class, 'download']);
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

        // Reports (summary + list endpoints for hub)
        Route::get('reports/summary', [\App\Http\Controllers\Api\V1\ReportsController::class, 'summary']);
        Route::get('reports/travel', [\App\Http\Controllers\Api\V1\ReportsController::class, 'travel']);
        Route::get('reports/leave', [\App\Http\Controllers\Api\V1\ReportsController::class, 'leave']);
        Route::get('reports/dsa', [\App\Http\Controllers\Api\V1\ReportsController::class, 'dsa']);
        Route::get('reports/assets', [\App\Http\Controllers\Api\V1\ReportsController::class, 'assets']);

        // Asset categories (CRUD; same auth as asset create)
        Route::get('asset-categories', [\App\Http\Controllers\Api\V1\Assets\AssetCategoryController::class, 'index']);
        Route::post('asset-categories', [\App\Http\Controllers\Api\V1\Assets\AssetCategoryController::class, 'store']);
        Route::put('asset-categories/{assetCategory}', [\App\Http\Controllers\Api\V1\Assets\AssetCategoryController::class, 'update']);
        Route::delete('asset-categories/{assetCategory}', [\App\Http\Controllers\Api\V1\Assets\AssetCategoryController::class, 'destroy']);

        // Assets (inventory, fleet - filter by category or assigned_to=me; create gated by admin/manager)
        Route::get('assets', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'index']);
        Route::post('assets', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'store']);
        Route::get('assets/{asset}', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'show']);
        Route::put('assets/{asset}', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'update']);
        Route::delete('assets/{asset}', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'destroy']);
        Route::get('assets/{asset}/qr', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'qr']);
        Route::post('assets/{asset}/invoice', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'uploadInvoice']);

        // Asset requests (any auth user can request; managers see all)
        Route::get('asset-requests', [\App\Http\Controllers\Api\V1\Assets\AssetRequestController::class, 'index']);
        Route::post('asset-requests', [\App\Http\Controllers\Api\V1\Assets\AssetRequestController::class, 'store']);
        Route::get('asset-requests/{assetRequest}', [\App\Http\Controllers\Api\V1\Assets\AssetRequestController::class, 'show']);
        Route::put('asset-requests/{assetRequest}', [\App\Http\Controllers\Api\V1\Assets\AssetRequestController::class, 'update']);
        Route::delete('asset-requests/{assetRequest}', [\App\Http\Controllers\Api\V1\Assets\AssetRequestController::class, 'destroy']);

        // Assignments, Oversight & Accountability
        Route::prefix('assignments')->group(function () {
            Route::get('stats', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'stats']);
            Route::apiResource('/', \App\Http\Controllers\Api\V1\Assignments\AssignmentController::class)
                ->parameter('', 'assignment')
                ->names('assignments');
            Route::post('{assignment}/issue',    [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'issue']);
            Route::post('{assignment}/accept',   [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'accept']);
            Route::post('{assignment}/start',    [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'start']);
            Route::post('{assignment}/updates',  [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'addUpdate']);
            Route::post('{assignment}/complete', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'complete']);
            Route::post('{assignment}/close',    [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'close']);
            Route::post('{assignment}/return',   [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'returnAssignment']);
            Route::post('{assignment}/cancel',   [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'cancel']);
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

        // Correspondence & Registry (ICRMS)
        Route::prefix('correspondence')->group(function () {
            Route::get('letters', [\App\Http\Controllers\Api\V1\Correspondence\CorrespondenceController::class, 'index']);
            Route::post('letters', [\App\Http\Controllers\Api\V1\Correspondence\CorrespondenceController::class, 'store']);
            Route::get('letters/{correspondence}', [\App\Http\Controllers\Api\V1\Correspondence\CorrespondenceController::class, 'show']);
            Route::put('letters/{correspondence}', [\App\Http\Controllers\Api\V1\Correspondence\CorrespondenceController::class, 'update']);
            Route::delete('letters/{correspondence}', [\App\Http\Controllers\Api\V1\Correspondence\CorrespondenceController::class, 'destroy']);
            Route::post('letters/{correspondence}/submit', [\App\Http\Controllers\Api\V1\Correspondence\CorrespondenceController::class, 'submit']);
            Route::post('letters/{correspondence}/review', [\App\Http\Controllers\Api\V1\Correspondence\CorrespondenceController::class, 'review']);
            Route::post('letters/{correspondence}/approve', [\App\Http\Controllers\Api\V1\Correspondence\CorrespondenceController::class, 'approve']);
            Route::post('letters/{correspondence}/send', [\App\Http\Controllers\Api\V1\Correspondence\CorrespondenceController::class, 'send']);
            Route::get('letters/{correspondence}/download', [\App\Http\Controllers\Api\V1\Correspondence\CorrespondenceController::class, 'download']);

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

        // Admin Workflows
        Route::prefix('admin/workflows')->group(function () {
             Route::get('/', [\App\Http\Controllers\Api\V1\Admin\WorkflowAdminController::class, 'index']);
             Route::post('/', [\App\Http\Controllers\Api\V1\Admin\WorkflowAdminController::class, 'store']);
             Route::put('{workflow}', [\App\Http\Controllers\Api\V1\Admin\WorkflowAdminController::class, 'update']);
             Route::delete('{workflow}', [\App\Http\Controllers\Api\V1\Admin\WorkflowAdminController::class, 'destroy']);
        });
    });
});
