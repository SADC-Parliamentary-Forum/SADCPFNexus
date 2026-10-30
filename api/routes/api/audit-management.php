<?php

// /api/v1/audit-management routes. Required from routes/api.php inside the authenticated
// group (auth:sanctum, session check, throttle, SetRlsContext, idempotency) —
// never register these routes outside that group.

use Illuminate\Support\Facades\Route;

// Audit Management Module (Phase 1) — Internal Audit ≠ platform AuditLog
Route::prefix('audit-management')->group(function () {
    $c = \App\Http\Controllers\Api\V1\Audit\AuditManagementController::class;

    Route::get('dashboard', [$c, 'dashboard']);
    Route::get('lookups', [$c, 'lookups']);
    Route::get('settings', [$c, 'settings']);
    Route::put('settings', [$c, 'updateSettings']);
    Route::middleware('can:audit.events.view')->get('events', [$c, 'events']);

    Route::get('universe', [$c, 'universeIndex']);
    Route::post('universe', [$c, 'universeStore']);
    Route::put('universe/{universe}', [$c, 'universeUpdate']);

    Route::get('plans', [$c, 'plansIndex']);
    Route::post('plans', [$c, 'plansStore']);
    Route::get('plans/{plan}', [$c, 'plansShow']);
    Route::put('plans/{plan}', [$c, 'plansUpdate']);
    Route::post('plans/{plan}/submit', [$c, 'plansSubmit']);
    Route::post('plans/{plan}/approve', [$c, 'plansApprove']);
    Route::post('plans/{plan}/reject', [$c, 'plansReject']);
    Route::post('plans/{plan}/amend', [$c, 'plansAmend']);

    Route::get('engagements', [$c, 'engagementsIndex']);
    Route::post('engagements', [$c, 'engagementsStore']);
    Route::get('engagements/{engagement}', [$c, 'engagementsShow']);
    Route::post('engagements/{engagement}/notify', [$c, 'engagementsNotify']);
    Route::post('engagements/{engagement}/independence', [$c, 'independenceDeclare']);
    Route::post('engagements/{engagement}/fieldwork', [$c, 'engagementsFieldwork']);
    Route::post('engagements/{engagement}/evidence-requests', [$c, 'evidenceStore']);
    Route::post('engagements/{engagement}/workpapers', [$c, 'workpapersStore']);
    Route::post('engagements/{engagement}/samples', [$c, 'samplesStore']);
    Route::post('engagements/{engagement}/observations', [$c, 'observationsStore']);

    Route::post('evidence-requests/{evidenceRequest}/respond', [$c, 'evidenceRespond']);
    Route::post('workpapers/{workpaper}/review-notes', [$c, 'workpapersReview']);
    Route::post('workpapers/{workpaper}/finalise', [$c, 'workpapersFinalise']);
    Route::post('observations/{observation}/convert', [$c, 'observationsConvert']);

    Route::get('findings', [$c, 'findingsIndex']);
    Route::post('findings', [$c, 'findingsStore']);
    Route::get('findings/{finding}', [$c, 'findingsShow']);
    Route::put('findings/{finding}', [$c, 'findingsUpdate']);
    Route::post('findings/{finding}/issue', [$c, 'findingsIssue']);
    Route::post('findings/{finding}/responses', [$c, 'findingsRespond']);
    Route::post('findings/{finding}/recommendations', [$c, 'findingsRecommend']);
    Route::post('findings/{finding}/corrective-actions', [$c, 'correctiveStore']);
    Route::post('findings/{finding}/link-risk', [$c, 'findingsLinkRisk']);
    Route::post('findings/{finding}/risk-acceptance-path', [$c, 'findingsRiskAcceptance']);

    Route::post('corrective-actions/{correctiveAction}/complete', [$c, 'correctiveComplete']);
    Route::post('corrective-actions/{correctiveAction}/verify', [$c, 'correctiveVerify']);

    Route::post('reports', [$c, 'reportsStore']);
    Route::put('reports/{report}', [$c, 'reportsUpdate']);
    Route::post('reports/{report}/issue', [$c, 'reportsIssue']);
    Route::post('reports/{report}/distribute', [$c, 'reportsDistribute']);

    Route::get('external', [$c, 'externalIndex']);
    Route::post('external', [$c, 'externalStore']);
    Route::post('external/{external}/activate', [$c, 'externalActivate']);
    Route::post('external/{external}/revoke', [$c, 'externalRevoke']);
    Route::post('external/{external}/requests', [$c, 'externalRequest']);
    Route::post('external/{external}/findings', [$c, 'externalFinding']);

    // Phase 2 / Phase 3
    $p23 = \App\Http\Controllers\Api\V1\Audit\AuditPhase23Controller::class;
    Route::get('analytics', [$p23, 'analytics']);
    Route::post('engagements/{engagement}/samples/extract', [$p23, 'extractSample']);
    Route::post('samples/{sample}/adjust', [$p23, 'adjustSample']);
    Route::get('campaigns', [$p23, 'listCampaigns']);
    Route::post('campaigns', [$p23, 'storeCampaign']);
    Route::get('effort/capacity', [$p23, 'capacity']);
    Route::post('effort/budgets', [$p23, 'storeEffortBudget']);
    Route::post('effort/entries', [$p23, 'storeEffortEntry']);
    Route::get('qa-reviews', [$p23, 'listQa']);
    Route::post('qa-reviews', [$p23, 'storeQa']);
    Route::get('templates', [$p23, 'listTemplates']);
    Route::post('templates/apply', [$p23, 'applyTemplate']);
    Route::post('governance-packs', [$p23, 'storeGovernancePack']);
    Route::get('appointments', [$p23, 'listAppointments']);
    Route::post('appointments', [$p23, 'storeAppointment']);
    Route::post('appointments/{appointment}/renewals', [$p23, 'renewAppointment']);
    Route::post('external/{external}/auto-revoke-check', [$p23, 'autoRevokeCheck']);
    Route::post('external/{external}/evidence-downloads', [$p23, 'evidenceDownload']);
    Route::post('ai/suggestions', [$p23, 'aiSuggest']);
    Route::post('ai/suggestions/{suggestion}/apply', [$p23, 'aiApply']);
});
