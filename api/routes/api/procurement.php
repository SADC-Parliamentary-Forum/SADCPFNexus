<?php

// /api/v1/procurement routes. Required from routes/api.php inside the authenticated
// group (auth:sanctum, session check, throttle, SetRlsContext, idempotency) —
// never register these routes outside that group.

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Procurement Module
Route::prefix('procurement')->group(function () {
    // Feature-only committee evaluations (distinct from tender board /evaluations).
    Route::get('committee-evaluations', [\App\Http\Controllers\Api\V1\Procurement\ProcurementEvaluationController::class, 'index']);
    Route::get('committee-evaluations/{procurementRequest}', [\App\Http\Controllers\Api\V1\Procurement\ProcurementEvaluationController::class, 'show']);
    Route::apiResource('requests', \App\Http\Controllers\Api\V1\Procurement\ProcurementController::class)
        ->parameters(['requests' => 'procurementRequest'])
        ->names('procurement.requests');
    Route::post('requests/{procurementRequest}/submit', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'submit']);
    Route::post('requests/{procurementRequest}/authorise-split', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'authoriseSplit']);
    Route::post('requests/{procurementRequest}/coi-declarations', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'storeCoiDeclaration']);
    Route::post('requests/{procurementRequest}/hod-approve', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'hodApprove']);
    Route::post('requests/{procurementRequest}/hod-reject', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'hodReject']);
    Route::post('requests/{procurementRequest}/approve', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'approve']);
    Route::post('requests/{procurementRequest}/reject', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'reject']);
    Route::post('requests/{procurementRequest}/return', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'returnForCorrection']);
    Route::post('requests/{procurementRequest}/withdraw', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'withdraw']);
    Route::post('requests/{procurementRequest}/resubmit', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'resubmit']);
    Route::get('requests/{procurementRequest}/certificate', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'certificate']);
    Route::post('requests/{procurementRequest}/award', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'award']);
    Route::post('requests/{procurementRequest}/issue-rfq', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'issueRfq']);
    Route::post('requests/{procurementRequest}/set-method', [\App\Http\Controllers\Api\V1\Procurement\ProcurementController::class, 'setMethod']);
    Route::post('requests/{procurementRequest}/reserve-budget', [\App\Http\Controllers\Api\V1\Procurement\BudgetReservationController::class, 'store']);
    Route::get('settings', [\App\Http\Controllers\Api\V1\Procurement\ProcurementSettingsController::class, 'show']);
    Route::put('settings', [\App\Http\Controllers\Api\V1\Procurement\ProcurementSettingsController::class, 'update']);

    // Quotes (per request)
    Route::get('requests/{procurementRequest}/quotes', [\App\Http\Controllers\Api\V1\Procurement\QuoteController::class, 'index']);
    Route::post('requests/{procurementRequest}/quotes', [\App\Http\Controllers\Api\V1\Procurement\QuoteController::class, 'store']);
    Route::put('requests/{procurementRequest}/quotes/{quote}', [\App\Http\Controllers\Api\V1\Procurement\QuoteController::class, 'update']);
    Route::post('requests/{procurementRequest}/quotes/{quote}/assess', [\App\Http\Controllers\Api\V1\Procurement\QuoteController::class, 'assess']);
    Route::delete('requests/{procurementRequest}/quotes/{quote}', [\App\Http\Controllers\Api\V1\Procurement\QuoteController::class, 'destroy']);
    Route::get('requests/{procurementRequest}/quotes/{quote}/attachments', [\App\Http\Controllers\Api\V1\Procurement\QuoteAttachmentController::class, 'index']);
    Route::post('requests/{procurementRequest}/quotes/{quote}/attachments', [\App\Http\Controllers\Api\V1\Procurement\QuoteAttachmentController::class, 'store']);
    Route::delete('requests/{procurementRequest}/quotes/{quote}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Procurement\QuoteAttachmentController::class, 'destroy']);
    Route::get('requests/{procurementRequest}/quotes/{quote}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Procurement\QuoteAttachmentController::class, 'download']);

    // Budget Reservations
    Route::get('budget-reservations', [\App\Http\Controllers\Api\V1\Procurement\BudgetReservationController::class, 'index']);
    Route::delete('budget-reservations/{budgetReservation}', [\App\Http\Controllers\Api\V1\Procurement\BudgetReservationController::class, 'destroy']);

    // Vendors
    Route::apiResource('vendors', \App\Http\Controllers\Api\V1\Procurement\VendorController::class)
        ->names('procurement.vendors');
    Route::get('supplier-categories', [\App\Http\Controllers\Api\V1\Procurement\SupplierCategoryController::class, 'index']);
    Route::post('supplier-categories', [\App\Http\Controllers\Api\V1\Procurement\SupplierCategoryController::class, 'store']);
    Route::put('supplier-categories/{supplierCategory}', [\App\Http\Controllers\Api\V1\Procurement\SupplierCategoryController::class, 'update']);
    Route::delete('supplier-categories/{supplierCategory}', [\App\Http\Controllers\Api\V1\Procurement\SupplierCategoryController::class, 'destroy']);
    Route::post('vendors/{vendor}/approve', [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'approve']);
    Route::post('vendors/{vendor}/reject', [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'reject']);
    Route::post('vendors/{vendor}/request-info', [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'requestInfo']);
    Route::post('vendors/{vendor}/suspend', [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'suspend']);
    Route::get('vendors/{vendor}/approval-logs', [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'approvalLogs']);
    Route::get('vendors/{vendor}/ratings', [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'listRatings']);
    Route::post('vendors/{vendor}/ratings', [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'storeRating']);
    Route::get('vendors/{vendor}/contracts', [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'listContracts']);
    Route::post('vendors/{vendor}/blacklist', [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'blacklist']);
    Route::post('vendors/{vendor}/unblacklist', [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'unblacklist']);
    Route::post('vendors/{vendor}/approve-conditional', [\App\Http\Controllers\Api\V1\Procurement\SupplierStaff360Controller::class, 'approveConditional']);
    Route::post('vendors/{vendor}/under-review', [\App\Http\Controllers\Api\V1\Procurement\SupplierStaff360Controller::class, 'markUnderReview']);
    Route::post('vendors/{vendor}/verify-banking', [\App\Http\Controllers\Api\V1\Procurement\SupplierStaff360Controller::class, 'verifyBanking']);
    Route::get('vendors/{vendor}/eligibility', [\App\Http\Controllers\Api\V1\Procurement\SupplierStaff360Controller::class, 'eligibility']);
    Route::get('vendors/{vendor}/360', [\App\Http\Controllers\Api\V1\Procurement\SupplierStaff360Controller::class, 'show']);
    Route::get('vendors/{vendor}/activity', [\App\Http\Controllers\Api\V1\Procurement\SupplierStaff360Controller::class, 'activity']);
    Route::get('vendors/{vendor}/register-documents', [\App\Http\Controllers\Api\V1\Procurement\SupplierStaff360Controller::class, 'documents']);
    Route::post('vendors/{vendor}/register-documents/{supplierDocument}/verify', [\App\Http\Controllers\Api\V1\Procurement\SupplierStaff360Controller::class, 'verifyDocument']);
    Route::post('vendors/{vendor}/register-documents/{supplierDocument}/reject', [\App\Http\Controllers\Api\V1\Procurement\SupplierStaff360Controller::class, 'rejectDocument']);
    Route::get('vendors/{vendor}/register-documents/{supplierDocument}/download', [\App\Http\Controllers\Api\V1\Procurement\SupplierStaff360Controller::class, 'downloadDocument']);
    Route::get('vendors/{vendor}/change-requests', [\App\Http\Controllers\Api\V1\Procurement\SupplierStaff360Controller::class, 'changeRequests']);
    Route::post('vendors/{vendor}/change-requests/{changeRequest}/approve', [\App\Http\Controllers\Api\V1\Procurement\SupplierStaff360Controller::class, 'approveChangeRequest']);
    Route::post('vendors/{vendor}/change-requests/{changeRequest}/reject', [\App\Http\Controllers\Api\V1\Procurement\SupplierStaff360Controller::class, 'rejectChangeRequest']);
    Route::post('vendors/{vendor}/invitations/{invitation}/eligibility-override', [\App\Http\Controllers\Api\V1\Procurement\SupplierStaff360Controller::class, 'overrideInvitation']);
    Route::get('supplier-document-requirement-types', [\App\Http\Controllers\Api\V1\Procurement\SupplierDocumentRequirementTypeController::class, 'index']);
    Route::post('supplier-document-requirement-types', [\App\Http\Controllers\Api\V1\Procurement\SupplierDocumentRequirementTypeController::class, 'store']);
    Route::put('supplier-document-requirement-types/{requirementType}', [\App\Http\Controllers\Api\V1\Procurement\SupplierDocumentRequirementTypeController::class, 'update']);
    Route::delete('supplier-document-requirement-types/{requirementType}', [\App\Http\Controllers\Api\V1\Procurement\SupplierDocumentRequirementTypeController::class, 'destroy']);
    Route::post('vendors/{vendor}/portal-users/{portalUser}/change-password', [\App\Http\Controllers\Api\V1\Procurement\VendorController::class, 'changePortalUserPassword']);
    Route::get('vendors/{vendor}/evaluations', [\App\Http\Controllers\Api\V1\Procurement\VendorPerformanceController::class, 'index']);
    Route::post('vendors/{vendor}/evaluations', [\App\Http\Controllers\Api\V1\Procurement\VendorPerformanceController::class, 'store']);

    Route::prefix('supplier')->group(function () {
        Route::get('me', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalController::class, 'me']);
        Route::get('categories', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalController::class, 'categories']);
        Route::get('attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalController::class, 'downloadAttachment']);
        Route::put('profile', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalController::class, 'updateProfile']);
        Route::get('dashboard', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalController::class, 'dashboard']);
        Route::get('completeness', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalApplicationController::class, 'completeness']);
        Route::post('submit-application', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalApplicationController::class, 'submitApplication']);
        Route::put('wizard', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalApplicationController::class, 'updateWizard']);
        Route::get('declarations', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalApplicationController::class, 'declarations']);
        Route::post('declarations', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalApplicationController::class, 'acceptDeclarations']);
        Route::get('documents', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalApplicationController::class, 'documents']);
        Route::post('documents', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalApplicationController::class, 'uploadDocument']);
        Route::get('documents/{supplierDocument}/download', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalApplicationController::class, 'downloadDocument']);
        Route::get('change-requests', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalApplicationController::class, 'changeRequests']);
        Route::post('verify-email/resend', [\App\Http\Controllers\Api\V1\Procurement\SupplierEmailVerificationController::class, 'resend']);
        Route::get('rfqs', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalController::class, 'rfqs']);
        Route::get('rfqs/{procurementRequest}', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalController::class, 'showRfq']);
        Route::post('rfqs/{procurementRequest}/quote', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalController::class, 'submitQuote']);
        Route::get('purchase-orders', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalController::class, 'purchaseOrders']);
        Route::post('purchase-orders/{purchaseOrder}/proforma-invoice', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalController::class, 'submitProformaInvoice']);
        Route::get('invoices', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalController::class, 'invoices']);
        Route::post('invoices/{invoice}/final-invoice', [\App\Http\Controllers\Api\V1\Procurement\SupplierPortalController::class, 'submitFinalInvoice']);
    });

    // Document intake (invoice / quote → LPO)
    Route::get('workbench', [\App\Http\Controllers\Api\V1\Procurement\ProcurementAutomationController::class, 'workbench']);
    Route::get('lpo-sequence', [\App\Http\Controllers\Api\V1\Procurement\ProcurementAutomationController::class, 'sequence']);
    Route::post('lpo-sequence/activate', [\App\Http\Controllers\Api\V1\Procurement\ProcurementAutomationController::class, 'activateSequence']);
    Route::get('numbering-profiles', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderNumberingController::class, 'show']);
    Route::post('numbering-profiles/parse', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderNumberingController::class, 'parse']);
    Route::post('numbering-profiles/activate', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderNumberingController::class, 'activate']);
    Route::post('numbering-profiles/set-next', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderNumberingController::class, 'setNext']);
    Route::get('po-templates/catalog', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderTemplateController::class, 'catalog']);
    Route::get('po-templates', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderTemplateController::class, 'index']);
    Route::post('po-templates', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderTemplateController::class, 'store']);
    Route::get('po-templates/{template}', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderTemplateController::class, 'show']);
    Route::put('po-templates/{template}', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderTemplateController::class, 'update']);
    Route::post('po-templates/{template}/publish', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderTemplateController::class, 'publish']);
    Route::post('po-templates/{template}/retire', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderTemplateController::class, 'retire']);
    Route::post('po-templates/{template}/default', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderTemplateController::class, 'setDefault']);
    Route::post('po-templates/{template}/preview', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderTemplateController::class, 'preview']);
    Route::get('projects', [\App\Http\Controllers\Api\V1\Procurement\ProcurementAutomationController::class, 'projects']);
    Route::post('projects', [\App\Http\Controllers\Api\V1\Procurement\ProcurementAutomationController::class, 'storeProject']);
    Route::get('exceptions', [\App\Http\Controllers\Api\V1\Procurement\ProcurementAutomationController::class, 'exceptions']);
    Route::post('exceptions/{exception}/approve', [\App\Http\Controllers\Api\V1\Procurement\ProcurementAutomationController::class, 'approveException']);
    Route::get('inbox', [\App\Http\Controllers\Api\V1\Procurement\ProcurementAutomationController::class, 'inbox']);
    Route::post('inbox', [\App\Http\Controllers\Api\V1\Procurement\ProcurementAutomationController::class, 'ingestInbox']);

    Route::get('intakes', [\App\Http\Controllers\Api\V1\Procurement\DocumentIntakeController::class, 'index']);
    Route::post('intakes', [\App\Http\Controllers\Api\V1\Procurement\DocumentIntakeController::class, 'store']);
    Route::get('intakes/{intake}', [\App\Http\Controllers\Api\V1\Procurement\DocumentIntakeController::class, 'show']);
    Route::post('intakes/{intake}/extract', [\App\Http\Controllers\Api\V1\Procurement\DocumentIntakeController::class, 'extract']);
    Route::post('intakes/{intake}/confirm', [\App\Http\Controllers\Api\V1\Procurement\DocumentIntakeController::class, 'confirm']);
    Route::get('intakes/{intake}/matches', [\App\Http\Controllers\Api\V1\Procurement\DocumentIntakeController::class, 'matches']);
    Route::post('intakes/{intake}/link-request', [\App\Http\Controllers\Api\V1\Procurement\DocumentIntakeController::class, 'linkRequest']);
    Route::post('intakes/{intake}/create-request', [\App\Http\Controllers\Api\V1\Procurement\DocumentIntakeController::class, 'createRequest']);
    Route::post('intakes/{intake}/supplier', [\App\Http\Controllers\Api\V1\Procurement\DocumentIntakeController::class, 'createSupplier']);
    Route::post('intakes/{intake}/purchase-orders', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderController::class, 'generateFromIntake']);
    Route::apiResource('purchase-orders', \App\Http\Controllers\Api\V1\Procurement\PurchaseOrderController::class)
        ->parameters(['purchase-orders' => 'purchaseOrder'])
        ->names('procurement.purchase-orders');
    Route::post('purchase-orders/{purchaseOrder}/issue', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderController::class, 'issue']);
    Route::post('purchase-orders/{purchaseOrder}/cancel', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderController::class, 'cancel']);
    Route::post('purchase-orders/{purchaseOrder}/submit', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderController::class, 'submit']);
    Route::post('purchase-orders/{purchaseOrder}/approve', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderController::class, 'approve']);
    Route::post('purchase-orders/{purchaseOrder}/return', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderController::class, 'returnLpo']);
    Route::post('purchase-orders/{purchaseOrder}/reject', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderController::class, 'reject']);
    Route::post('purchase-orders/{purchaseOrder}/email', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderController::class, 'email']);
    Route::get('purchase-orders/{purchaseOrder}/pdf', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderController::class, 'pdf']);
    Route::post('purchase-orders/{purchaseOrder}/service-confirmations', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderController::class, 'serviceConfirmation']);
    Route::post('purchase-orders/{purchaseOrder}/invoice-match', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderController::class, 'invoiceMatch']);
    Route::post('purchase-orders/{purchaseOrder}/finance-handover', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderController::class, 'financeHandover']);
    Route::post('purchase-orders/{purchaseOrder}/void', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderController::class, 'void']);
    Route::post('purchase-orders/{purchaseOrder}/amend', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderController::class, 'amend']);

    // Invoices
    Route::apiResource('invoices', \App\Http\Controllers\Api\V1\Procurement\InvoiceController::class)
        ->only(['index', 'show', 'store']);
    Route::post('invoices/{invoice}/approve', [\App\Http\Controllers\Api\V1\Procurement\InvoiceController::class, 'approve']);
    Route::post('invoices/{invoice}/reject', [\App\Http\Controllers\Api\V1\Procurement\InvoiceController::class, 'reject']);
    Route::post('invoices/{invoice}/mark-paid', [\App\Http\Controllers\Api\V1\Procurement\InvoiceController::class, 'markPaid']);

    // Contracts
    Route::apiResource('contracts', \App\Http\Controllers\Api\V1\Procurement\ContractController::class)
        ->only(['index', 'show', 'store', 'destroy']);
    Route::post('contracts/{contract}/activate', [\App\Http\Controllers\Api\V1\Procurement\ContractController::class, 'activate']);
    Route::post('contracts/{contract}/terminate', [\App\Http\Controllers\Api\V1\Procurement\ContractController::class, 'terminate']);
    Route::get('contracts/{contract}/milestones', [\App\Http\Controllers\Api\V1\Procurement\ContractMilestoneController::class, 'index']);
    Route::post('contracts/{contract}/milestones', [\App\Http\Controllers\Api\V1\Procurement\ContractMilestoneController::class, 'store']);
    Route::put('contracts/{contract}/milestones/{milestone}', [\App\Http\Controllers\Api\V1\Procurement\ContractMilestoneController::class, 'update']);
    Route::post('contracts/{contract}/milestones/{milestone}/complete', [\App\Http\Controllers\Api\V1\Procurement\ContractMilestoneController::class, 'complete']);
    Route::delete('contracts/{contract}/milestones/{milestone}', [\App\Http\Controllers\Api\V1\Procurement\ContractMilestoneController::class, 'destroy']);

    Route::get('tenders', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'index']);
    Route::post('tenders', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'store']);
    Route::get('tenders/{tender}', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'show']);
    Route::post('tenders/{tender}/publish', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'publish']);
    Route::post('tenders/{tender}/close', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'close']);
    Route::post('tenders/{tender}/open-bids', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'openBids']);
    Route::post('tenders/{tender}/start-evaluation', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'startEvaluation']);
    Route::post('tenders/{tender}/award', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'award']);
    Route::post('tenders/{tender}/recommend-award', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'recommendAward']);
    Route::post('tenders/{tender}/cancel', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'cancel']);
    Route::post('tenders/{tender}/comparison-summary', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'comparisonSummary']);
    Route::post('tenders/{tender}/comparison-summary/confirm', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'confirmComparisonSummary']);

    Route::get('evaluations', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'evaluations']);
    Route::get('bid-submissions', [\App\Http\Controllers\Api\V1\Procurement\TenderController::class, 'bidSubmissions']);
    Route::get('notice-board', [\App\Http\Controllers\Api\V1\Procurement\PublicNoticeController::class, 'staffIndex']);
    Route::get('newspaper-notice-templates', [\App\Http\Controllers\Api\V1\Procurement\PublicNoticeController::class, 'newspaperTemplates']);
    Route::get('tenders/{tender}/newspaper-notice', [\App\Http\Controllers\Api\V1\Procurement\PublicNoticeController::class, 'newspaperPack']);
    Route::patch('tenders/{tender}/newspaper-notice-checklist', [\App\Http\Controllers\Api\V1\Procurement\PublicNoticeController::class, 'newspaperChecklist']);
    Route::post('tenders/{tender}/newspaper-notice-llm-draft', [\App\Http\Controllers\Api\V1\Procurement\PublicNoticeController::class, 'newspaperLlmDraft']);

    Route::get('policy-profiles', [\App\Http\Controllers\Api\V1\Procurement\ProcurementPolicyProfileController::class, 'index']);
    Route::post('policy-profiles', [\App\Http\Controllers\Api\V1\Procurement\ProcurementPolicyProfileController::class, 'store']);
    Route::get('policy-profiles/{policyProfile}', [\App\Http\Controllers\Api\V1\Procurement\ProcurementPolicyProfileController::class, 'show']);
    Route::put('policy-profiles/{policyProfile}', [\App\Http\Controllers\Api\V1\Procurement\ProcurementPolicyProfileController::class, 'update']);
    Route::delete('policy-profiles/{policyProfile}', [\App\Http\Controllers\Api\V1\Procurement\ProcurementPolicyProfileController::class, 'destroy']);
    Route::post('policy-profiles/{policyProfile}/activate', [\App\Http\Controllers\Api\V1\Procurement\ProcurementPolicyProfileController::class, 'activate']);

    Route::get('tender-committees', [\App\Http\Controllers\Api\V1\Procurement\TenderCommitteeController::class, 'index']);
    Route::post('tender-committees', [\App\Http\Controllers\Api\V1\Procurement\TenderCommitteeController::class, 'store']);
    Route::get('tender-committees/{tenderCommittee}', [\App\Http\Controllers\Api\V1\Procurement\TenderCommitteeController::class, 'show']);
    Route::post('tender-committees/{tenderCommittee}/meetings', [\App\Http\Controllers\Api\V1\Procurement\TenderCommitteeController::class, 'storeMeeting']);

    Route::get('plans', [\App\Http\Controllers\Api\V1\Procurement\AnnualProcurementPlanController::class, 'index']);
    Route::post('plans', [\App\Http\Controllers\Api\V1\Procurement\AnnualProcurementPlanController::class, 'store']);
    Route::get('plans/{plan}', [\App\Http\Controllers\Api\V1\Procurement\AnnualProcurementPlanController::class, 'show']);
    Route::post('plans/{plan}/items', [\App\Http\Controllers\Api\V1\Procurement\AnnualProcurementPlanController::class, 'storeItem']);
    Route::delete('plans/{plan}', [\App\Http\Controllers\Api\V1\Procurement\AnnualProcurementPlanController::class, 'destroy']);

    Route::get('catalogue', [\App\Http\Controllers\Api\V1\Procurement\VendorCatalogueController::class, 'index']);
    Route::post('catalogue', [\App\Http\Controllers\Api\V1\Procurement\VendorCatalogueController::class, 'store']);
    Route::get('catalogue/{catalogue}', [\App\Http\Controllers\Api\V1\Procurement\VendorCatalogueController::class, 'show']);
    Route::put('catalogue/{catalogue}', [\App\Http\Controllers\Api\V1\Procurement\VendorCatalogueController::class, 'update']);
    Route::get('catalogue/{catalogue}/history', [\App\Http\Controllers\Api\V1\Procurement\VendorCatalogueController::class, 'history']);
    Route::delete('catalogue/{catalogue}', [\App\Http\Controllers\Api\V1\Procurement\VendorCatalogueController::class, 'destroy']);

    // Analytics
    Route::prefix('analytics')->group(function () {
        Route::get('summary', [\App\Http\Controllers\Api\V1\Procurement\ProcurementAnalyticsController::class, 'summary']);
        Route::get('spend-by-category', [\App\Http\Controllers\Api\V1\Procurement\ProcurementAnalyticsController::class, 'spendByCategory']);
        Route::get('vendor-performance', [\App\Http\Controllers\Api\V1\Procurement\ProcurementAnalyticsController::class, 'vendorPerformance']);
        Route::get('flags', [\App\Http\Controllers\Api\V1\Procurement\ProcurementAnalyticsController::class, 'flags']);
    });

    // Goods Receipts — top-level listing
    Route::get('receipts', [\App\Http\Controllers\Api\V1\Procurement\GoodsReceiptController::class, 'indexAll']);

    // Goods Receipts (nested under POs)
    Route::get('purchase-orders/{purchaseOrder}/receipts', [\App\Http\Controllers\Api\V1\Procurement\GoodsReceiptController::class, 'index']);
    Route::post('purchase-orders/{purchaseOrder}/receipts', [\App\Http\Controllers\Api\V1\Procurement\GoodsReceiptController::class, 'store']);
    Route::get('purchase-orders/{purchaseOrder}/receipts/{receipt}', [\App\Http\Controllers\Api\V1\Procurement\GoodsReceiptController::class, 'show']);
    Route::post('purchase-orders/{purchaseOrder}/receipts/{receipt}/accept', [\App\Http\Controllers\Api\V1\Procurement\GoodsReceiptController::class, 'accept']);
    Route::post('purchase-orders/{purchaseOrder}/receipts/{receipt}/reject', [\App\Http\Controllers\Api\V1\Procurement\GoodsReceiptController::class, 'reject']);

    // Procurement Request Attachments
    Route::get('requests/{procurementRequest}/attachments', [\App\Http\Controllers\Api\V1\Procurement\ProcurementRequestAttachmentController::class, 'index']);
    Route::post('requests/{procurementRequest}/attachments', [\App\Http\Controllers\Api\V1\Procurement\ProcurementRequestAttachmentController::class, 'store']);
    Route::delete('requests/{procurementRequest}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Procurement\ProcurementRequestAttachmentController::class, 'destroy']);
    Route::get('requests/{procurementRequest}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Procurement\ProcurementRequestAttachmentController::class, 'download']);

    // Purchase Order Attachments
    Route::get('purchase-orders/{purchaseOrder}/attachments', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderAttachmentController::class, 'index']);
    Route::post('purchase-orders/{purchaseOrder}/attachments', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderAttachmentController::class, 'store']);
    Route::delete('purchase-orders/{purchaseOrder}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderAttachmentController::class, 'destroy']);
    Route::get('purchase-orders/{purchaseOrder}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Procurement\PurchaseOrderAttachmentController::class, 'download']);

    // Invoice Attachments
    Route::get('invoices/{invoice}/attachments', [\App\Http\Controllers\Api\V1\Procurement\InvoiceAttachmentController::class, 'index']);
    Route::post('invoices/{invoice}/attachments', [\App\Http\Controllers\Api\V1\Procurement\InvoiceAttachmentController::class, 'store']);
    Route::delete('invoices/{invoice}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Procurement\InvoiceAttachmentController::class, 'destroy']);
    Route::get('invoices/{invoice}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Procurement\InvoiceAttachmentController::class, 'download']);

    // Contract Attachments
    Route::get('contracts/{contract}/attachments', [\App\Http\Controllers\Api\V1\Procurement\ContractAttachmentController::class, 'index']);
    Route::post('contracts/{contract}/attachments', [\App\Http\Controllers\Api\V1\Procurement\ContractAttachmentController::class, 'store']);
    Route::delete('contracts/{contract}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Procurement\ContractAttachmentController::class, 'destroy']);
    Route::get('contracts/{contract}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Procurement\ContractAttachmentController::class, 'download']);

    // Goods Receipt Attachments
    Route::get('receipts/{goodsReceiptNote}/attachments', [\App\Http\Controllers\Api\V1\Procurement\GoodsReceiptAttachmentController::class, 'index']);
    Route::post('receipts/{goodsReceiptNote}/attachments', [\App\Http\Controllers\Api\V1\Procurement\GoodsReceiptAttachmentController::class, 'store']);
    Route::delete('receipts/{goodsReceiptNote}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Procurement\GoodsReceiptAttachmentController::class, 'destroy']);
    Route::get('receipts/{goodsReceiptNote}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Procurement\GoodsReceiptAttachmentController::class, 'download']);

    // Vendor Attachments
    Route::get('vendors/{vendor}/attachments', [\App\Http\Controllers\Api\V1\Procurement\VendorAttachmentController::class, 'index']);
    Route::post('vendors/{vendor}/attachments', [\App\Http\Controllers\Api\V1\Procurement\VendorAttachmentController::class, 'store']);
    Route::delete('vendors/{vendor}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Procurement\VendorAttachmentController::class, 'destroy']);
    Route::get('vendors/{vendor}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Procurement\VendorAttachmentController::class, 'download']);
});
