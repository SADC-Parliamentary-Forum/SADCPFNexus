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

    // External Integrations APIs
    Route::prefix('external')->group(function () {
        Route::get('workplan', [\App\Http\Controllers\Api\V1\Workplan\WorkplanExternalController::class, 'index']);
    });

    // Authenticated routes
    Route::middleware(['auth:sanctum', \App\Http\Middleware\SetRlsContext::class])->group(function () {

        Route::prefix('auth')->group(function () {
            Route::post('logout', [AuthController::class, 'logout']);
            Route::get('me', [AuthController::class, 'me']);
        });

        // User Profile (Self-Service)
        Route::get('profile', [\App\Http\Controllers\Api\V1\ProfileController::class, 'show']);
        Route::put('profile', [\App\Http\Controllers\Api\V1\ProfileController::class, 'update']);
        Route::put('profile/password', [\App\Http\Controllers\Api\V1\ProfileController::class, 'updatePassword']);

        // Profile Documents (Self-Service)
        Route::get('profile/documents', [\App\Http\Controllers\Api\V1\ProfileDocumentController::class, 'index']);
        Route::post('profile/documents', [\App\Http\Controllers\Api\V1\ProfileDocumentController::class, 'store']);
        Route::delete('profile/documents/{attachment}', [\App\Http\Controllers\Api\V1\ProfileDocumentController::class, 'destroy']);
        Route::get('profile/documents/{attachment}/download', [\App\Http\Controllers\Api\V1\ProfileDocumentController::class, 'download']);

        Route::get('dashboard/stats', [\App\Http\Controllers\Api\V1\DashboardController::class, 'stats']);
        Route::get('dashboard/upcoming-social', [\App\Http\Controllers\Api\V1\DashboardController::class, 'upcomingSocial']);

        Route::get('lookups', [\App\Http\Controllers\Api\V1\LookupsController::class, 'index']);
        Route::get('tenant-users', [\App\Http\Controllers\Api\V1\TenantUsersController::class, 'index']);

        // Admin - User Management
        Route::prefix('admin')->group(function () {
            // Users
            Route::apiResource('users', \App\Http\Controllers\Api\V1\Admin\UsersController::class);
            Route::post('users/{user}/reactivate', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'reactivate']);
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

            // Positions (establishment register)
            Route::apiResource('positions', \App\Http\Controllers\Api\V1\Admin\PositionController::class);
            Route::post('positions/{position}/assign', [\App\Http\Controllers\Api\V1\Admin\PositionController::class, 'assign']);
        });

        // Module routes will be added here per module

        // Travel Module
        Route::prefix('travel')->group(function () {
            Route::apiResource('requests', \App\Http\Controllers\Api\V1\Travel\TravelController::class)
                ->parameters(['requests' => 'travelRequest']);
            Route::post('requests/{travelRequest}/submit', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'submit']);
            Route::post('requests/{travelRequest}/approve', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'approve']);
            Route::post('requests/{travelRequest}/reject', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'reject']);
        });

        // Imprest Module
        Route::prefix('imprest')->group(function () {
            Route::apiResource('requests', \App\Http\Controllers\Api\V1\Imprest\ImprestController::class)
                ->parameters(['requests' => 'imprestRequest']);
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
                ->parameters(['requests' => 'leaveRequest']);
            Route::post('requests/{leaveRequest}/submit', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'submit']);
            Route::post('requests/{leaveRequest}/approve', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'approve']);
            Route::post('requests/{leaveRequest}/reject', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'reject']);
        });

        // Procurement Module
        Route::prefix('procurement')->group(function () {
            Route::apiResource('requests', \App\Http\Controllers\Api\V1\Procurement\ProcurementController::class)
                ->parameters(['requests' => 'procurementRequest']);
            Route::post('requests/{procurementRequest}/submit', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'submit']);
            Route::post('requests/{procurementRequest}/approve', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'approve']);
            Route::post('requests/{procurementRequest}/reject', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'reject']);

            // Vendors
            Route::get('vendors', [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'index']);
            Route::post('vendors', [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'store']);
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
            Route::get('timesheets', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'index']);
            Route::post('timesheets/import', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'import']);
            Route::get('timesheets/{timesheet}', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'show']);
            Route::post('timesheets', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'store']);
            Route::put('timesheets/{timesheet}', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'update']);
            Route::post('timesheets/{timesheet}/submit', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'submit']);
            Route::post('timesheets/{timesheet}/approve', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'approve']);
            Route::post('timesheets/{timesheet}/reject', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'reject']);
            Route::get('incidents', [\App\Http\Controllers\Api\V1\Hr\HrIncidentController::class, 'index']);
            Route::post('incidents', [\App\Http\Controllers\Api\V1\Hr\HrIncidentController::class, 'store']);
            Route::get('incidents/{hrIncident}', [\App\Http\Controllers\Api\V1\Hr\HrIncidentController::class, 'show']);
        });

        // HR - Work Assignments
        Route::prefix('hr')->group(function () {
            Route::get('assignments/stats', [\App\Http\Controllers\Api\V1\Hr\WorkAssignmentController::class, 'stats']);
            Route::apiResource('assignments', \App\Http\Controllers\Api\V1\Hr\WorkAssignmentController::class)
                ->only(['index', 'store', 'show', 'update'])
                ->parameters(['assignment' => 'workAssignment']);
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

            // HR Documents (aggregated list; returns empty when no backend aggregation)
            Route::get('documents', function () {
                return response()->json(['data' => []]);
            });
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
        });

        // Programmes (PIF)
        Route::prefix('programmes')->group(function () {
            Route::apiResource('', \App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class)
                ->parameter('', 'programme');
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
        Route::get('assets/{asset}', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'show']);
        Route::put('assets/{asset}', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'update']);
        Route::get('assets/{asset}/qr', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'qr']);
        Route::post('assets', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'store']);
        Route::post('assets/{asset}/invoice', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'uploadInvoice']);

        // Asset requests (any auth user can request; managers see all)
        Route::get('asset-requests', [\App\Http\Controllers\Api\V1\Assets\AssetRequestController::class, 'index']);
        Route::post('asset-requests', [\App\Http\Controllers\Api\V1\Assets\AssetRequestController::class, 'store']);

        // Assignments, Oversight & Accountability
        Route::prefix('assignments')->group(function () {
            Route::get('stats', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'stats']);
            Route::apiResource('/', \App\Http\Controllers\Api\V1\Assignments\AssignmentController::class)
                ->parameter('', 'assignment');
            Route::post('{assignment}/issue',    [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'issue']);
            Route::post('{assignment}/accept',   [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'accept']);
            Route::post('{assignment}/start',    [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'start']);
            Route::post('{assignment}/updates',  [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'addUpdate']);
            Route::post('{assignment}/complete', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'complete']);
            Route::post('{assignment}/close',    [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'close']);
            Route::post('{assignment}/return',   [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'returnAssignment']);
            Route::post('{assignment}/cancel',   [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'cancel']);
        });

        // Governance (meetings from workplan, resolutions)
        Route::get('governance/meetings', [\App\Http\Controllers\Api\V1\Governance\GovernanceController::class, 'meetings']);
        Route::get('governance/resolutions', [\App\Http\Controllers\Api\V1\Governance\GovernanceController::class, 'resolutions']);

        // Support tickets
        Route::get('support/tickets', [\App\Http\Controllers\Api\V1\Support\SupportTicketController::class, 'index']);
        Route::post('support/tickets', [\App\Http\Controllers\Api\V1\Support\SupportTicketController::class, 'store']);
        Route::get('support/tickets/{supportTicket}', [\App\Http\Controllers\Api\V1\Support\SupportTicketController::class, 'show']);

        // Alerts
        Route::get('alerts/summary', [\App\Http\Controllers\Api\V1\Alerts\AlertsController::class, 'summary']);

        // Approval Workflows
        Route::prefix('approvals')->group(function () {
            Route::get('pending', [\App\Http\Controllers\Api\V1\ApprovalController::class, 'pending']);
            Route::post('{approvalRequest}/approve', [\App\Http\Controllers\Api\V1\ApprovalController::class, 'approve']);
            Route::post('{approvalRequest}/reject', [\App\Http\Controllers\Api\V1\ApprovalController::class, 'reject']);
            Route::get('{approvalRequest}/history', [\App\Http\Controllers\Api\V1\ApprovalController::class, 'history']);
        });

        // Admin Workflows
        Route::prefix('admin/workflows')->group(function () {
             Route::get('/', [\App\Http\Controllers\Api\V1\Admin\WorkflowAdminController::class, 'index']);
             Route::post('/', [\App\Http\Controllers\Api\V1\Admin\WorkflowAdminController::class, 'store']);
             Route::put('{workflow}', [\App\Http\Controllers\Api\V1\Admin\WorkflowAdminController::class, 'update']);
        });
    });
});
