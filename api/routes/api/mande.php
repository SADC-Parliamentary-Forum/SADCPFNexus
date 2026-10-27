<?php

// /api/v1/mande routes. Required from routes/api.php inside the authenticated
// group (auth:sanctum, session check, throttle, SetRlsContext, idempotency) —
// never register these routes outside that group.

use Illuminate\Support\Facades\Route;

// ── M&E / Results Monitoring (PRD §10 + §23.5) ─────────────────────────
Route::prefix('mande')->group(function () {
    // Dashboard & strategic reporting (read — gated on mande.view)
    Route::middleware('can:mande.view')->group(function () {
        Route::get('dashboard', [\App\Http\Controllers\Api\V1\MAndE\MeDashboardController::class, 'summary']);
        Route::get('reports/strategic', [\App\Http\Controllers\Api\V1\MAndE\MeReportingController::class, 'strategic']);
        Route::get('reports/donor', [\App\Http\Controllers\Api\V1\MAndE\MeReportingController::class, 'donor']);
        Route::get('data-quality', [\App\Http\Controllers\Api\V1\MAndE\MeDataQualityController::class, 'index']);
        Route::get('pif-linkages', [\App\Http\Controllers\Api\V1\MAndE\MeActivityReportController::class, 'linkablePifs']);
        Route::get('settings', [\App\Http\Controllers\Api\V1\MAndE\MeSettingsController::class, 'show']);
    });
    Route::middleware('can:mande.admin')->group(function () {
        Route::post('import/preview', [\App\Http\Controllers\Api\V1\MAndE\MeImportController::class, 'preview']);
        Route::post('import/commit', [\App\Http\Controllers\Api\V1\MAndE\MeImportController::class, 'commit']);
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
        Route::post('strategic-plans', [\App\Http\Controllers\Api\V1\MAndE\StrategicPlanController::class, 'store']);
        Route::put('strategic-plans/{strategicPlan}', [\App\Http\Controllers\Api\V1\MAndE\StrategicPlanController::class, 'update']);
        Route::delete('strategic-plans/{strategicPlan}', [\App\Http\Controllers\Api\V1\MAndE\StrategicPlanController::class, 'destroy']);
        Route::post('strategic-plans/{strategicPlan}/archive', [\App\Http\Controllers\Api\V1\MAndE\StrategicPlanController::class, 'archive']);
        Route::post('strategic-plans/{strategicPlan}/activate', [\App\Http\Controllers\Api\V1\MAndE\StrategicPlanController::class, 'activate']);
        Route::post('strategic-plans/{strategicPlan}/goals', [\App\Http\Controllers\Api\V1\MAndE\StrategicPlanController::class, 'addGoal']);
        Route::post('strategic-goals/{goal}/objectives', [\App\Http\Controllers\Api\V1\MAndE\StrategicPlanController::class, 'addObjective']);
        Route::post('strategic-objectives/{objective}/outcomes', [\App\Http\Controllers\Api\V1\MAndE\StrategicPlanController::class, 'addOutcome']);
        Route::post('strategic-outcomes/{outcome}/outputs', [\App\Http\Controllers\Api\V1\MAndE\StrategicPlanController::class, 'addOutput']);
        Route::delete('strategic-nodes/{type}/{id}', [\App\Http\Controllers\Api\V1\MAndE\StrategicPlanController::class, 'deleteNode']);
    });

    // Results Frameworks (§10.5)
    Route::middleware('can:mande.view')->get('results-frameworks', [\App\Http\Controllers\Api\V1\MAndE\ResultsFrameworkController::class, 'index']);
    Route::middleware('can:mande.view')->get('results-frameworks/{resultsFramework}', [\App\Http\Controllers\Api\V1\MAndE\ResultsFrameworkController::class, 'show']);
    Route::middleware('can:mande.admin')->group(function () {
        Route::post('results-frameworks', [\App\Http\Controllers\Api\V1\MAndE\ResultsFrameworkController::class, 'store']);
        Route::put('results-frameworks/{resultsFramework}', [\App\Http\Controllers\Api\V1\MAndE\ResultsFrameworkController::class, 'update']);
        Route::delete('results-frameworks/{resultsFramework}', [\App\Http\Controllers\Api\V1\MAndE\ResultsFrameworkController::class, 'destroy']);
    });

    // Indicators (§10.6)
    Route::middleware('can:mande.view')->get('indicators', [\App\Http\Controllers\Api\V1\MAndE\IndicatorController::class, 'index']);
    Route::middleware('can:mande.view')->get('indicators/aggregation', [\App\Http\Controllers\Api\V1\MAndE\MeAiAssistController::class, 'aggregation']);
    Route::middleware('can:mande.view')->get('indicators/{indicator}', [\App\Http\Controllers\Api\V1\MAndE\IndicatorController::class, 'show']);
    Route::middleware('can:mande.view')->get('indicators/{indicator}/versions', [\App\Http\Controllers\Api\V1\MAndE\IndicatorController::class, 'versions']);
    Route::middleware('can:mande.view')->get('calendar', [\App\Http\Controllers\Api\V1\MAndE\MeReportingController::class, 'calendar']);
    Route::middleware('can:mande.view')->post('ai-assist', [\App\Http\Controllers\Api\V1\MAndE\MeAiAssistController::class, 'draft']);
    Route::middleware('can:mande.view')->post('ai-assist/confirm', [\App\Http\Controllers\Api\V1\MAndE\MeAiAssistController::class, 'confirm']);
    Route::middleware('can:mande.create')->group(function () {
        Route::post('indicators', [\App\Http\Controllers\Api\V1\MAndE\IndicatorController::class, 'store']);
        Route::put('indicators/{indicator}', [\App\Http\Controllers\Api\V1\MAndE\IndicatorController::class, 'update']);
        Route::delete('indicators/{indicator}', [\App\Http\Controllers\Api\V1\MAndE\IndicatorController::class, 'destroy']);
        Route::post('indicators/{indicator}/versions', [\App\Http\Controllers\Api\V1\MAndE\IndicatorController::class, 'createVersion']);
    });

    // Activity Reports (§10.7 + §10.8)
    Route::middleware('can:mande.view')->group(function () {
        Route::get('activity-reports', [\App\Http\Controllers\Api\V1\MAndE\MeActivityReportController::class, 'index']);
        Route::get('activity-reports/{activityReport}', [\App\Http\Controllers\Api\V1\MAndE\MeActivityReportController::class, 'show']);
        Route::get('activity-reports/{activityReport}/history', [\App\Http\Controllers\Api\V1\MAndE\MeActivityReportController::class, 'history']);
    });
    Route::middleware('can:mande.create')->group(function () {
        Route::post('activity-reports', [\App\Http\Controllers\Api\V1\MAndE\MeActivityReportController::class, 'store']);
        Route::put('activity-reports/{activityReport}', [\App\Http\Controllers\Api\V1\MAndE\MeActivityReportController::class, 'update']);
        Route::delete('activity-reports/{activityReport}', [\App\Http\Controllers\Api\V1\MAndE\MeActivityReportController::class, 'destroy']);
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
        Route::post('activity-reports/{activityReport}/review', [\App\Http\Controllers\Api\V1\MAndE\MeReviewController::class, 'review']);
        Route::post('activity-reports/{activityReport}/return', [\App\Http\Controllers\Api\V1\MAndE\MeReviewController::class, 'requestCorrection']);
        Route::post('activity-reports/{activityReport}/accept', [\App\Http\Controllers\Api\V1\MAndE\MeReviewController::class, 'accept']);
        Route::post('activity-reports/{activityReport}/close', [\App\Http\Controllers\Api\V1\MAndE\MeReviewController::class, 'close']);
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
        Route::post('thematic-areas', [\App\Http\Controllers\Api\V1\MAndE\MeThematicAreaController::class, 'store']);
        Route::put('thematic-areas/{thematicArea}', [\App\Http\Controllers\Api\V1\MAndE\MeThematicAreaController::class, 'update']);
        Route::delete('thematic-areas/{thematicArea}', [\App\Http\Controllers\Api\V1\MAndE\MeThematicAreaController::class, 'destroy']);
    });
});
