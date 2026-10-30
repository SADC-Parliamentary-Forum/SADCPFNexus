<?php

// /api/v1/correspondence routes. Required from routes/api.php inside the authenticated
// group (auth:sanctum, session check, throttle, SetRlsContext, idempotency) —
// never register these routes outside that group.

use Illuminate\Support\Facades\Route;

// Correspondence & Registry (ICRMS) — Phase 1 Register
Route::prefix('correspondence')->group(function () {
    $letters = \App\Http\Controllers\Api\V1\Correspondence\CorrespondenceController::class;
    $register = \App\Http\Controllers\Api\V1\Correspondence\CorrespondenceRegisterController::class;

    Route::get('letters', [$letters, 'index']);
    Route::post('letters', [$letters, 'store']);
    Route::post('letters/incoming/register', [$register, 'registerIncoming']);
    Route::get('letters/{correspondence}/registry-pack', [$register, 'registryPack']);
    Route::get('letters/{correspondence}', [$letters, 'show']);
    Route::put('letters/{correspondence}', [$letters, 'update']);
    Route::delete('letters/{correspondence}', [$letters, 'destroy']);
    Route::post('letters/{correspondence}/submit', [$letters, 'submit']);
    Route::post('letters/{correspondence}/review', [$letters, 'review']);
    Route::post('letters/{correspondence}/approve', [$letters, 'approve']);
    Route::post('letters/{correspondence}/send', [$letters, 'send']);
    Route::get('letters/{correspondence}/download', [$letters, 'download']);

    $merge = \App\Http\Controllers\Api\V1\Correspondence\CorrespondenceMailMergeController::class;
    Route::get('templates', [$merge, 'indexTemplates']);
    Route::post('templates', [$merge, 'storeTemplate']);
    Route::post('mail-merge/preview', [$merge, 'preview']);
    Route::post('mail-merge/create', [$merge, 'createFromTemplate']);
    Route::post('letters/{correspondence}/ai-assist', [$merge, 'aiAssist']);
    Route::post('letters/{correspondence}/ai-assist/confirm', [$merge, 'confirmAiAssist']);

    Route::post('letters/{correspondence}/sg-route', [$register, 'sgRoute']);
    Route::post('letters/{correspondence}/acknowledge', [$register, 'acknowledge']);
    Route::get('letters/{correspondence}/notes', [$register, 'notes']);
    Route::post('letters/{correspondence}/notes', [$register, 'addNote']);
    Route::post('letters/{correspondence}/relationships', [$register, 'linkRelationship']);
    Route::post('letters/{correspondence}/sign', [$register, 'sign']);
    Route::post('letters/{correspondence}/dispatch', [$register, 'dispatchItem']);
    Route::post('letters/{correspondence}/void-reference', [$register, 'voidReference']);
    Route::post('letters/{correspondence}/assignments', [$register, 'linkAssignment']);
    Route::post('letters/{correspondence}/subject-files', [$register, 'linkSubjectFile']);

    $retention = \App\Http\Controllers\Api\V1\Correspondence\CorrespondenceRetentionController::class;
    Route::get('legal-holds', [$retention, 'indexHolds']);
    Route::put('letters/{correspondence}/retention', [$retention, 'update']);
    Route::post('letters/{correspondence}/release-hold', [$retention, 'releaseHold']);
    Route::post('letters/{correspondence}/purge', [$retention, 'purge']);

    Route::patch('dispatches/{dispatch}/delivery', [$register, 'updateDelivery']);
    Route::post('dispatches/{dispatch}/refresh-tracking', [\App\Http\Controllers\Api\V1\Correspondence\CourierTrackingController::class, 'refresh']);
    Route::post('archive/import', [\App\Http\Controllers\Api\V1\Correspondence\CorrespondenceArchiveImportController::class, 'store']);

    Route::get('subject-files', [$register, 'subjectFiles']);
    Route::post('subject-files', [$register, 'storeSubjectFile']);
    Route::get('master-register', [$register, 'masterRegister']);
    Route::get('my-actions', [$register, 'myActions']);
    Route::get('reports/summary', [$register, 'reportSummary']);
    Route::get('settings/numbering', [$register, 'numberingPolicy']);
    Route::put('settings/numbering', [$register, 'updateNumberingPolicy']);

    $mailbox = \App\Http\Controllers\Api\V1\Correspondence\CorrespondenceMailboxController::class;
    Route::get('mailbox/settings', [$mailbox, 'settings']);
    Route::put('mailbox/settings', [$mailbox, 'updateSettings']);
    Route::get('mailbox/suggestions', [$mailbox, 'indexSuggestions']);
    Route::post('mailbox/suggestions/import', [$mailbox, 'importSuggestion']);
    Route::post('mailbox/suggestions/{suggestion}/register', [$mailbox, 'registerSuggestion']);
    Route::post('mailbox/suggestions/{suggestion}/dismiss', [$mailbox, 'dismissSuggestion']);

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
