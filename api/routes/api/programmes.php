<?php

// /api/v1/programmes routes. Required from routes/api.php inside the authenticated
// group (auth:sanctum, session check, throttle, SetRlsContext, idempotency) —
// never register these routes outside that group.

use Illuminate\Support\Facades\Route;

// Programmes (PIF)
Route::prefix('programmes')->group(function () {
    Route::apiResource('', \App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class)
        ->parameter('', 'programme')
        ->names('programmes');
    Route::get('{programme}/timeline', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'timeline']);
    Route::post('{programme}/submit', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'submit']);
    Route::post('{programme}/approve', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'approve']);
    Route::post('{programme}/reject', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'reject']);
    Route::post('{programme}/amend', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'amend']);
    Route::post('{programme}/submit-amendment', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'submitAmendment']);
    Route::get('{programme}/diff', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'diff']);
    Route::post('{programme}/send-to-procurement', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'sendToProcurement']);
    Route::post('{programme}/send-to-travel', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'sendToTravel']);
    Route::get('{programme}/pdf', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'pdf']);
    Route::middleware('can:programme.finance-review')
        ->put('{programme}/finance-review', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'updateFinanceReview']);

    Route::apiResource('{programme}/activities', \App\Http\Controllers\Api\V1\Programmes\ProgrammeActivityController::class)
        ->only(['store', 'update', 'destroy'])->parameters(['activities' => 'activity']);
    Route::apiResource('{programme}/milestones', \App\Http\Controllers\Api\V1\Programmes\ProgrammeMilestoneController::class)
        ->only(['store', 'update', 'destroy'])->parameters(['milestones' => 'milestone']);
    Route::apiResource('{programme}/deliverables', \App\Http\Controllers\Api\V1\Programmes\ProgrammeDeliverableController::class)
        ->only(['store', 'update', 'destroy'])->parameters(['deliverables' => 'deliverable']);
    Route::apiResource('{programme}/budget-lines', \App\Http\Controllers\Api\V1\Programmes\ProgrammeBudgetLineController::class)
        ->only(['store', 'update', 'destroy'])->parameters(['budget-lines' => 'budgetLine']);
    Route::apiResource('{programme}/procurement', \App\Http\Controllers\Api\V1\Programmes\ProgrammeProcurementItemController::class)
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
