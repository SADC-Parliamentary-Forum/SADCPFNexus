<?php

// /api/v1/documents routes. Required from routes/api.php inside the authenticated
// group (auth:sanctum, session check, throttle, SetRlsContext, idempotency) —
// never register these routes outside that group.

use Illuminate\Support\Facades\Route;

// Shared Document Service — PRD Phase 1–3 (repository + governance)
Route::prefix('documents')->group(function () {
    $c = \App\Http\Controllers\Api\V1\Documents\DocumentServiceController::class;
    Route::get('/', [$c, 'index']);
    Route::get('search', [$c, 'search']);
    Route::post('/', [$c, 'upload']);
    Route::get('audit', [$c, 'audit']);
    Route::get('backup-status', [$c, 'backupStatus']);
    Route::get('retention/dashboard', [$c, 'retentionDashboard']);
    Route::post('retention/campaigns', [$c, 'createRetentionCampaign']);
    Route::post('uploads/initiate', [$c, 'initiateUpload']);
    Route::post('uploads/{sessionUuid}/chunk', [$c, 'appendChunk']);
    Route::post('uploads/{sessionUuid}/complete', [$c, 'completeUpload']);
    Route::post('bulk-rescan', [$c, 'bulkRescan']);
    Route::get('migration-status', [$c, 'migrationStatus']);
    Route::get('governance', [$c, 'governanceIndex']);
    Route::put('governance/{decision}', [$c, 'governanceUpdate']);
    Route::get('verify/{hash}', [$c, 'verify']);
    Route::get('duplicates/{hash}', [$c, 'duplicates']);
    Route::get('versions/{version}/download', [$c, 'download']);
    Route::post('versions/{version}/download-token', [$c, 'issueToken']);
    Route::post('versions/{version}/finalize', [$c, 'markFinal']);
    Route::post('versions/{version}/external-share', [$c, 'externalShare']);
    Route::post('versions/{version}/ocr', [$c, 'queueOcr']);
    Route::post('versions/{version}/redact', [$c, 'redact']);
    Route::get('download-token/{token}', [$c, 'downloadViaToken']);
    Route::post('{document}/legal-hold', [$c, 'placeLegalHold']);
    Route::delete('{document}/legal-hold', [$c, 'releaseLegalHold']);
    Route::put('{document}/retention', [$c, 'setRetention']);
    Route::post('{document}/purge', [$c, 'purge']);
    Route::post('{document}/disposal', [$c, 'requestDisposal']);
    Route::put('{document}/physical-archive', [$c, 'updatePhysicalArchive']);
    Route::post('{document}/ai-suggest', [$c, 'aiSuggest']);
    Route::get('{document}', [$c, 'show']);
    Route::get('{document}/versions', [$c, 'versions']);
});
