<?php

// /api/v1/contracts routes. Required from routes/api.php inside the authenticated
// group (auth:sanctum, session check, throttle, SetRlsContext, idempotency) —
// never register these routes outside that group.

use Illuminate\Support\Facades\Route;

// Contract Management (first-class module; supersedes procurement nested contracts)
Route::prefix('contracts')->group(function () {
    Route::get('', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'index']);
    Route::post('', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'store']);
    Route::get('types', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'types']);
    Route::post('types', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'storeType']);
    Route::patch('types/{type}', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'updateType']);
    Route::get('currencies', [\App\Http\Controllers\Api\V1\Contracts\CurrencyController::class, 'index']);
    Route::post('currencies', [\App\Http\Controllers\Api\V1\Contracts\CurrencyController::class, 'store']);
    Route::patch('currencies/{currency}', [\App\Http\Controllers\Api\V1\Contracts\CurrencyController::class, 'update']);
    Route::post('extract', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'extract']);
    Route::post('import', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'importLegacy']);
    Route::post('prefill', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'prefill']);

    // Reports & registers
    Route::get('reports/exceptions', [\App\Http\Controllers\Api\V1\Contracts\ContractReportController::class, 'exceptions']);
    Route::get('reports/analytics', [\App\Http\Controllers\Api\V1\Contracts\ContractReportController::class, 'analytics']);
    Route::get('reports/risk', [\App\Http\Controllers\Api\V1\Contracts\ContractReportController::class, 'risk']);

    // Authority Matrix + delegated authority (PRD §41-42)
    Route::get('authority/rules', [\App\Http\Controllers\Api\V1\Contracts\ContractAuthorityController::class, 'index']);
    Route::post('authority/rules', [\App\Http\Controllers\Api\V1\Contracts\ContractAuthorityController::class, 'store']);
    Route::patch('authority/rules/{rule}', [\App\Http\Controllers\Api\V1\Contracts\ContractAuthorityController::class, 'update']);
    Route::get('authority/delegations', [\App\Http\Controllers\Api\V1\Contracts\ContractAuthorityController::class, 'delegations']);
    Route::post('authority/delegations', [\App\Http\Controllers\Api\V1\Contracts\ContractAuthorityController::class, 'storeDelegation']);
    Route::delete('authority/delegations/{delegation}', [\App\Http\Controllers\Api\V1\Contracts\ContractAuthorityController::class, 'revokeDelegation']);

    // Configurable compliance requirements (PRD §81-82)
    Route::get('compliance/requirements', [\App\Http\Controllers\Api\V1\Contracts\ContractComplianceController::class, 'index']);
    Route::post('compliance/requirements', [\App\Http\Controllers\Api\V1\Contracts\ContractComplianceController::class, 'store']);
    Route::patch('compliance/requirements/{requirement}', [\App\Http\Controllers\Api\V1\Contracts\ContractComplianceController::class, 'update']);
    Route::get('reports', [\App\Http\Controllers\Api\V1\Contracts\ContractReportController::class, 'index']);

    // Template library (versioned)
    Route::get('templates', [\App\Http\Controllers\Api\V1\Contracts\ContractTemplateController::class, 'index']);
    Route::post('templates', [\App\Http\Controllers\Api\V1\Contracts\ContractTemplateController::class, 'store']);
    Route::get('templates/{template}', [\App\Http\Controllers\Api\V1\Contracts\ContractTemplateController::class, 'show']);
    Route::post('templates/{template}/versions', [\App\Http\Controllers\Api\V1\Contracts\ContractTemplateController::class, 'storeVersion']);
    Route::post('templates/{template}/versions/{version}/activate', [\App\Http\Controllers\Api\V1\Contracts\ContractTemplateController::class, 'activateVersion']);

    // Clause library (versioned)
    Route::get('clauses', [\App\Http\Controllers\Api\V1\Contracts\ContractClauseController::class, 'index']);
    Route::post('clauses', [\App\Http\Controllers\Api\V1\Contracts\ContractClauseController::class, 'store']);
    Route::post('clauses/{clause}/versions', [\App\Http\Controllers\Api\V1\Contracts\ContractClauseController::class, 'addVersion']);
    Route::post('clauses/{clause}/versions/{version}/activate', [\App\Http\Controllers\Api\V1\Contracts\ContractClauseController::class, 'activateVersion']);
    Route::get('clauses/{clause}/compare', [\App\Http\Controllers\Api\V1\Contracts\ContractClauseController::class, 'compareVersions']);

    Route::get('{contract}', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'show']);
    Route::get('{contract}/readiness', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'readiness']);
    Route::post('{contract}/generate', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'generate']);
    Route::post('{contract}/deliverables', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'addDeliverable']);
    Route::post('{contract}/obligations', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'addObligation']);

    // Approval workflow (shared Nexus engine)
    Route::post('{contract}/submit', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'submit']);
    Route::post('{contract}/approve', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'approve']);
    Route::post('{contract}/return', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'returnForCorrection']);
    Route::post('{contract}/reject', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'reject']);
    Route::post('{contract}/withdraw', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'withdraw']);
    Route::get('{contract}/exceptions', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'exceptions']);
    Route::get('{contract}/authority', [\App\Http\Controllers\Api\V1\Contracts\ContractAuthorityController::class, 'forContract']);
    Route::get('{contract}/compliance', [\App\Http\Controllers\Api\V1\Contracts\ContractComplianceController::class, 'forContract']);
    Route::get('{contract}/invoices', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'invoices']);
    Route::post('{contract}/invoices/{invoice}/link', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'linkInvoice']);
    Route::delete('{contract}/invoices/{invoice}/link', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'unlinkInvoice']);
    Route::get('{contract}/disputes', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'disputes']);
    Route::post('{contract}/disputes', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'createDispute']);
    Route::patch('{contract}/disputes/{dispute}', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'updateDispute']);

    // Key personnel + replacement approval (PRD §80)
    Route::get('{contract}/key-personnel', [\App\Http\Controllers\Api\V1\Contracts\ContractKeyPersonnelController::class, 'index']);
    Route::post('{contract}/key-personnel', [\App\Http\Controllers\Api\V1\Contracts\ContractKeyPersonnelController::class, 'store']);
    Route::post('{contract}/key-personnel/{personnel}/replace', [\App\Http\Controllers\Api\V1\Contracts\ContractKeyPersonnelController::class, 'requestReplacement']);
    Route::post('{contract}/personnel-replacements/{replacement}/approve', [\App\Http\Controllers\Api\V1\Contracts\ContractKeyPersonnelController::class, 'approveReplacement']);
    Route::post('{contract}/personnel-replacements/{replacement}/reject', [\App\Http\Controllers\Api\V1\Contracts\ContractKeyPersonnelController::class, 'rejectReplacement']);
    Route::get('{contract}/correspondence', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'correspondence']);
    Route::post('{contract}/correspondence', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'createCorrespondence']);

    // Execution & signature
    Route::post('{contract}/send-for-signature', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'sendForSignature']);
    Route::post('{contract}/resend-signature-email', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'resendSignatureEmail']);
    Route::post('{contract}/sign', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'signInternal']);
    Route::post('{contract}/wet-sign', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'wetSign']);

    // Financials, deliverables, amendments, close-out
    Route::get('{contract}/ledger', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'ledger']);
    Route::post('{contract}/check-payment', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'checkPayment']);
    Route::post('{contract}/payment-schedules', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'addPaymentSchedule']);
    Route::post('{contract}/deliverables/{deliverable}/review', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'acceptDeliverable']);
    Route::post('{contract}/amendments', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'createAmendment']);
    Route::post('{contract}/amendments/{amendment}/approve', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'approveAmendment']);
    Route::post('{contract}/close', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'close']);
    Route::get('{contract}/audit', [\App\Http\Controllers\Api\V1\Contracts\ContractReportController::class, 'audit']);
    Route::get('{contract}/documents/compare', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'compareDocuments']);
    Route::get('{contract}/pack', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'pack']);
    Route::get('{contract}/pack-index', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'packIndex']);
    Route::get('{contract}/performance-reviews', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'performanceReviews']);
    Route::post('{contract}/performance-review', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'performanceReview']);

    // Per-contract clause assignments
    Route::get('{contract}/clauses', [\App\Http\Controllers\Api\V1\Contracts\ContractClauseController::class, 'contractClauses']);
    Route::post('{contract}/clauses', [\App\Http\Controllers\Api\V1\Contracts\ContractClauseController::class, 'assign']);
    Route::delete('{contract}/clauses/{assignment}', [\App\Http\Controllers\Api\V1\Contracts\ContractClauseController::class, 'unassign']);
    Route::delete('{contract}', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'destroy']);
    Route::post('{contract}/activate', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'activate']);
    Route::post('{contract}/suspend', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'suspend']);
    Route::post('{contract}/resume', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'resume']);
    Route::post('{contract}/terminate', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'terminate']);
    Route::get('{contract}/call-offs', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'callOffs']);
    Route::post('{contract}/call-offs', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'createCallOff']);
    Route::post('{contract}/extensions', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'createExtension']);
    Route::post('{contract}/extensions/{extension}/approve', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'approveExtension']);
    Route::post('{contract}/renewals', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'createRenewal']);
    Route::post('{contract}/renewals/{renewal}/approve', [\App\Http\Controllers\Api\V1\Contracts\ContractController::class, 'approveRenewal']);

    // Reuse the existing milestone + attachment controllers (bound by {contract}).
    Route::get('{contract}/milestones', [\App\Http\Controllers\Api\V1\Procurement\ContractMilestoneController::class, 'index']);
    Route::post('{contract}/milestones', [\App\Http\Controllers\Api\V1\Procurement\ContractMilestoneController::class, 'store']);
    Route::put('{contract}/milestones/{milestone}', [\App\Http\Controllers\Api\V1\Procurement\ContractMilestoneController::class, 'update']);
    Route::post('{contract}/milestones/{milestone}/complete', [\App\Http\Controllers\Api\V1\Procurement\ContractMilestoneController::class, 'complete']);
    Route::delete('{contract}/milestones/{milestone}', [\App\Http\Controllers\Api\V1\Procurement\ContractMilestoneController::class, 'destroy']);
    Route::get('{contract}/attachments', [\App\Http\Controllers\Api\V1\Procurement\ContractAttachmentController::class, 'index']);
    Route::post('{contract}/attachments', [\App\Http\Controllers\Api\V1\Procurement\ContractAttachmentController::class, 'store']);
    Route::delete('{contract}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Procurement\ContractAttachmentController::class, 'destroy']);
    Route::get('{contract}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Procurement\ContractAttachmentController::class, 'download']);
});
