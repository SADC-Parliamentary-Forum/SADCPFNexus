<?php

// /api/v1/risk routes. Required from routes/api.php inside the authenticated
// group (auth:sanctum, session check, throttle, SetRlsContext, idempotency) —
// never register these routes outside that group.

use Illuminate\Support\Facades\Route;

// Risk Register Module
Route::prefix('risk')->group(function () {
    Route::get('dashboard', [\App\Http\Controllers\Api\V1\Risk\RiskDashboardController::class, 'summary']);
    Route::get('lookups/objectives', [\App\Http\Controllers\Api\V1\Risk\RiskController::class, 'listObjectives']);
    Route::get('lookups/owners', [\App\Http\Controllers\Api\V1\Risk\RiskController::class, 'listOwners']);
    Route::post('mitigations', [\App\Http\Controllers\Api\V1\Risk\RiskActionController::class, 'applyToRisks']);
    Route::get('audit-trail', [\App\Http\Controllers\Api\V1\Risk\RiskController::class, 'auditTrail']);
    Route::get('matrix', [\App\Http\Controllers\Api\V1\Risk\RiskMatrixController::class, 'matrix']);

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
    Route::get('bcp-exercises', [\App\Http\Controllers\Api\V1\Risk\RiskPhase3Controller::class, 'listBcpExercises']);
    Route::post('bcp-exercises', [\App\Http\Controllers\Api\V1\Risk\RiskPhase3Controller::class, 'storeBcpExercise']);
    Route::post('bcp-exercises/{bcpExercise}/complete', [\App\Http\Controllers\Api\V1\Risk\RiskPhase3Controller::class, 'completeBcpExercise']);
    Route::get('insurance-renewals', [\App\Http\Controllers\Api\V1\Risk\RiskPhase3Controller::class, 'listInsuranceRenewals']);
    Route::get('dependencies', [\App\Http\Controllers\Api\V1\Risk\RiskPhase3Controller::class, 'listDependencies']);
    Route::post('dependencies', [\App\Http\Controllers\Api\V1\Risk\RiskPhase3Controller::class, 'storeDependency']);

    Route::apiResource('risks', \App\Http\Controllers\Api\V1\Risk\RiskController::class);
    Route::post('risks/{risk}/submit', [\App\Http\Controllers\Api\V1\Risk\RiskController::class, 'submit']);
    Route::post('risks/{risk}/start-review', [\App\Http\Controllers\Api\V1\Risk\RiskController::class, 'startReview']);
    Route::post('risks/{risk}/approve', [\App\Http\Controllers\Api\V1\Risk\RiskController::class, 'approve']);
    Route::post('risks/{risk}/escalate', [\App\Http\Controllers\Api\V1\Risk\RiskController::class, 'escalate']);
    Route::post('risks/{risk}/close', [\App\Http\Controllers\Api\V1\Risk\RiskController::class, 'close']);
    Route::post('risks/{risk}/archive', [\App\Http\Controllers\Api\V1\Risk\RiskController::class, 'archive']);
    Route::post('risks/{risk}/reopen', [\App\Http\Controllers\Api\V1\Risk\RiskController::class, 'reopen']);
    Route::get('risks/{risk}/logs', [\App\Http\Controllers\Api\V1\Risk\RiskController::class, 'logs']);

    Route::get('risks/{risk}/actions', [\App\Http\Controllers\Api\V1\Risk\RiskActionController::class, 'index']);
    Route::post('risks/{risk}/actions', [\App\Http\Controllers\Api\V1\Risk\RiskActionController::class, 'store']);
    Route::put('risks/{risk}/actions/{action}', [\App\Http\Controllers\Api\V1\Risk\RiskActionController::class, 'update']);
    Route::post('risks/{risk}/actions/{action}/complete', [\App\Http\Controllers\Api\V1\Risk\RiskActionController::class, 'markComplete']);
    Route::post('risks/{risk}/actions/{action}/create-assignment', [\App\Http\Controllers\Api\V1\Risk\RiskActionController::class, 'createAssignment']);
    Route::delete('risks/{risk}/actions/{action}', [\App\Http\Controllers\Api\V1\Risk\RiskActionController::class, 'destroy']);

    // Phase 1 extensions
    Route::get('risks/{risk}/assessments', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'listAssessments']);
    Route::post('risks/{risk}/assessments', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'storeAssessment']);
    Route::post('risks/{risk}/acceptances', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'requestAcceptance']);
    Route::post('acceptances/{acceptance}/decide', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'decideAcceptance']);
    Route::post('risks/{risk}/materialise', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'materialise']);
    Route::post('risks/{risk}/accept-proposal', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'acceptProposal']);
    Route::post('risks/{risk}/reject-proposal', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'rejectProposal']);
    Route::get('controls', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'listControls']);
    Route::post('controls', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'storeControl']);
    Route::post('risks/{risk}/controls', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'linkControl']);
    Route::get('incidents', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'listIncidents']);
    Route::post('incidents', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'storeIncident']);
    Route::get('appetite-policies', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'appetiteIndex']);
    Route::post('appetite-policies', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'appetiteStore']);
    Route::post('appetite-policies/{policy}/activate', [\App\Http\Controllers\Api\V1\Risk\RiskPhase1Controller::class, 'appetiteActivate']);

    // Risk Attachments
    Route::get('risks/{risk}/attachments', [\App\Http\Controllers\Api\V1\Risk\RiskAttachmentController::class, 'index']);
    Route::post('risks/{risk}/attachments', [\App\Http\Controllers\Api\V1\Risk\RiskAttachmentController::class, 'store']);
    Route::delete('risks/{risk}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Risk\RiskAttachmentController::class, 'destroy']);
    Route::get('risks/{risk}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Risk\RiskAttachmentController::class, 'download']);

    // Policy Library
    Route::apiResource('policies', \App\Http\Controllers\Api\V1\Risk\PolicyController::class);
    Route::get('risks/{risk}/policies', [\App\Http\Controllers\Api\V1\Risk\PolicyController::class, 'listForRisk']);
    Route::post('policies/{policy}/attach-risk', [\App\Http\Controllers\Api\V1\Risk\PolicyController::class, 'attachToRisk']);
    Route::delete('policies/{policy}/detach-risk/{risk}', [\App\Http\Controllers\Api\V1\Risk\PolicyController::class, 'detachFromRisk']);

    // Policy Attachments
    Route::get('policies/{policy}/attachments', [\App\Http\Controllers\Api\V1\Risk\PolicyAttachmentController::class, 'index']);
    Route::post('policies/{policy}/attachments', [\App\Http\Controllers\Api\V1\Risk\PolicyAttachmentController::class, 'store']);
    Route::delete('policies/{policy}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Risk\PolicyAttachmentController::class, 'destroy']);
    Route::get('policies/{policy}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Risk\PolicyAttachmentController::class, 'download']);
});
