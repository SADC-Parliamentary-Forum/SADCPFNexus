<?php

use App\Http\Controllers\Api\V1\AuthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {

    // Public auth routes
    Route::prefix('auth')->group(function () {
        Route::post('login', [AuthController::class, 'login']);
    });

    // Authenticated routes
    Route::middleware(['auth:sanctum', \App\Http\Middleware\SetRlsContext::class])->group(function () {

        Route::prefix('auth')->group(function () {
            Route::post('logout', [AuthController::class, 'logout']);
            Route::get('me', [AuthController::class, 'me']);
        });

        Route::get('dashboard/stats', [\App\Http\Controllers\Api\V1\DashboardController::class, 'stats']);

        Route::get('lookups', [\App\Http\Controllers\Api\V1\LookupsController::class, 'index']);

        // Admin - User Management
        Route::prefix('admin')->group(function () {
            // Users
            Route::apiResource('users', \App\Http\Controllers\Api\V1\Admin\UsersController::class);
            Route::post('users/{user}/reactivate', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'reactivate']);
            Route::get('users/{user}/audit', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'audit']);

            // Departments
            Route::apiResource('departments', \App\Http\Controllers\Api\V1\Admin\DepartmentsController::class)
                ->only(['index', 'store', 'update']);

            // Roles & Permissions
            Route::get('roles', [\App\Http\Controllers\Api\V1\Admin\RolesController::class, 'index']);
            Route::post('roles', [\App\Http\Controllers\Api\V1\Admin\RolesController::class, 'store']);
            Route::put('roles/{role}/permissions', [\App\Http\Controllers\Api\V1\Admin\RolesController::class, 'syncPermissions']);
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

        // Finance - Salary Advances, Payslips, Summary
        Route::prefix('finance')->group(function () {
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
            Route::get('timesheets/{timesheet}', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'show']);
            Route::post('timesheets', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'store']);
            Route::put('timesheets/{timesheet}', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'update']);
            Route::post('timesheets/{timesheet}/submit', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'submit']);
            Route::post('timesheets/{timesheet}/approve', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'approve']);
            Route::post('timesheets/{timesheet}/reject', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'reject']);
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
        });

        // Workplan
        Route::apiResource('workplan/events', \App\Http\Controllers\Api\V1\Workplan\WorkplanController::class)
            ->parameters(['events' => 'event']);

        // Alerts
        Route::get('alerts/summary', [\App\Http\Controllers\Api\V1\Alerts\AlertsController::class, 'summary']);
    });
});
