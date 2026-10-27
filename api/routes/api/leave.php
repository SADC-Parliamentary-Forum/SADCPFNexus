<?php

// /api/v1/leave routes. Required from routes/api.php inside the authenticated
// group (auth:sanctum, session check, throttle, SetRlsContext, idempotency) —
// never register these routes outside that group.

use Illuminate\Support\Facades\Route;

Route::prefix('leave')->group(function () {
    Route::get('types', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'types']);
    Route::get('policies', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'policies']);
    Route::get('policies/active', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'activePolicy']);
    Route::post('policies', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'storePolicy']);
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
    Route::get('my-calendar', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'myCalendar']);
    Route::get('register/export', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'registerExport']);
    Route::get('import/template', [\App\Http\Controllers\Api\V1\Leave\LeaveImportController::class, 'template']);
    Route::post('import', [\App\Http\Controllers\Api\V1\Leave\LeaveImportController::class, 'store']);
    Route::get('requests/bulk-import/template', [\App\Http\Controllers\Api\V1\Leave\LeaveBulkCaptureController::class, 'template']);
    Route::post('requests/bulk-import', [\App\Http\Controllers\Api\V1\Leave\LeaveBulkCaptureController::class, 'store']);
    Route::get('requests/{badLeaveRequest}', fn () => abort(404))->where('badLeaveRequest', '[^0-9]+');
    Route::apiResource('requests', \App\Http\Controllers\Api\V1\Leave\LeaveController::class)
        ->parameters(['requests' => 'leaveRequest'])
        ->names('leave.requests');
    Route::post('requests/{leaveRequest}/submit', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'submit']);
    Route::post('requests/{leaveRequest}/recommend', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'recommend']);
    Route::post('requests/{leaveRequest}/certify', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'certify']);
    Route::post('requests/{leaveRequest}/approve', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'approve']);
    Route::post('requests/{leaveRequest}/reject', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'reject']);
    Route::post('requests/{leaveRequest}/return', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'returnForCorrection']);
    Route::post('requests/{leaveRequest}/withdraw', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'withdraw']);
    Route::post('requests/{leaveRequest}/resubmit', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'resubmit']);
    Route::get('requests/{leaveRequest}/certificate', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'certificate']);
    Route::get('requests/{leaveRequest}/pdf', [\App\Http\Controllers\Api\V1\Leave\LeaveController::class, 'pdf']);
    // Leave attachments
    Route::get('requests/{leaveRequest}/attachments', [\App\Http\Controllers\Api\V1\Leave\LeaveAttachmentController::class, 'index']);
    Route::post('requests/{leaveRequest}/attachments', [\App\Http\Controllers\Api\V1\Leave\LeaveAttachmentController::class, 'store']);
    Route::delete('requests/{leaveRequest}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Leave\LeaveAttachmentController::class, 'destroy']);
    Route::get('requests/{leaveRequest}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Leave\LeaveAttachmentController::class, 'download']);
});
