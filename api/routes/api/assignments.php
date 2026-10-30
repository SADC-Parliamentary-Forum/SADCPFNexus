<?php

// /api/v1/assignments routes. Required from routes/api.php inside the authenticated
// group (auth:sanctum, session check, throttle, SetRlsContext, idempotency) —
// never register these routes outside that group.

use Illuminate\Support\Facades\Route;

// Assignments, Oversight & Accountability
Route::prefix('assignments')->group(function () {
    Route::get('stats', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'stats']);
    Route::get('mine', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'mine']);
    Route::get('team', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'team']);
    Route::get('register', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'register']);
    Route::get('calendar', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'calendar']);
    Route::get('calendar.ics', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'calendarIcs']);
    Route::post('calendar/import-ics', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'importIcs']);
    Route::get('calendar-feed', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'calendarFeed']);
    Route::post('calendar-feed/rotate', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'rotateCalendarFeed']);
    Route::get('capacity', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'capacity']);
    Route::get('workload-forecast', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'workloadForecast']);
    Route::get('handover-pack.docx', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'handoverPackDocx']);
    Route::get('handover-pack', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'handoverPack']);
    Route::get('nl-search', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'nlSearch']);
    Route::post('nl-search', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'nlSearch']);
    Route::get('review-queue', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'reviewQueue']);
    Route::get('reports/summary', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'reportsSummary']);
    Route::get('weekly-summary-feed', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'weeklySummaryFeed']);
    Route::post('from-source', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'fromSource']);
    Route::post('templates', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'storeTemplate']);
    Route::apiResource('/', \App\Http\Controllers\Api\V1\Assignments\AssignmentController::class)
        ->parameter('', 'assignment')
        ->names('assignments');
    Route::post('{assignment}/issue', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'issue']);
    Route::post('{assignment}/accept', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'accept']);
    Route::post('{assignment}/claim', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'claim']);
    Route::post('{assignment}/start', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'start']);
    Route::post('{assignment}/updates', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'addUpdate']);
    Route::post('{assignment}/block', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'block']);
    Route::post('{assignment}/unblock', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'unblock']);
    Route::post('{assignment}/complete', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'complete']);
    Route::post('{assignment}/verify', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'verify']);
    Route::post('{assignment}/close', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'close']);
    Route::post('{assignment}/return', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'returnAssignment']);
    Route::post('{assignment}/cancel', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'cancel']);
    Route::post('{assignment}/reassign', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'reassign']);
    Route::post('{assignment}/change-due-date', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'changeDueDate']);
    Route::post('{assignment}/participants', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'addParticipant']);
    Route::post('{assignment}/checklist', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'addChecklistItem']);
    Route::post('{assignment}/checklist/{checklistItem}/toggle', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'toggleChecklistItem']);
    Route::post('{assignment}/subtasks', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'createSubtask']);
    Route::get('{assignment}/dependencies', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'dependencies']);
    Route::get('{assignment}/timesheet-hours', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'timesheetHours']);
    Route::post('{assignment}/dependencies', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'addDependency']);
    Route::delete('{assignment}/dependencies/{dependency}', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'removeDependency']);
    Route::post('{assignment}/generate', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'generateFromTemplate']);
});
