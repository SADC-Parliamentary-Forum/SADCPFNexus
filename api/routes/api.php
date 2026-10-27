<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Support\CorsHelper;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {

    // Explicit OPTIONS catch-all for CORS preflight (ensures preflight always gets CORS headers)
    Route::options('{path?}', function (Request $request) {
        return response('', 204)->withHeaders(CorsHelper::headersForRequest($request));
    })->where('path', '.*')->name('api.cors.preflight');

    // Public auth routes
    Route::prefix('auth')->group(function () {
        Route::get('captcha', [AuthController::class, 'captchaConfig'])->middleware('throttle:30,1');
        Route::post('captcha-challenge', [AuthController::class, 'captchaChallenge'])->middleware('throttle:20,1');
        Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
        Route::post('forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
        Route::post('access-request', [AuthController::class, 'accessRequest'])->middleware('throttle:5,1');
        Route::post('reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');
        Route::get('invitations/{token}', [AuthController::class, 'showInvitation'])->middleware('throttle:20,1');
        Route::post('invitations/{token}/activate', [AuthController::class, 'activateInvitation'])->middleware('throttle:5,1');
        // Lightweight connection pre-warm used by the mobile splash screen.
        Route::get('ping', fn () => response()->json(['ok' => true]))->middleware('throttle:60,1');
    });

    // Email action preview — unauthenticated (token is the access control)
    Route::get('email-action/preview/{token}',
        [\App\Http\Controllers\Api\V1\EmailAction\EmailActionController::class, 'preview']
    )->middleware('throttle:20,1');

    // External integration feed — X-External-Token or workplan.external Sanctum
    Route::prefix('external')->group(function () {
        Route::get('workplan', [\App\Http\Controllers\Api\V1\Workplan\WorkplanExternalController::class, 'index'])
            ->middleware([
                'throttle:30,1',
                \App\Http\Middleware\AuthenticateExternalWorkplan::class,
            ]);

        // External counterparty signing portal (token-gated, no account).
        Route::middleware('throttle:30,1')->group(function () {
            Route::get('contracts/sign/{token}', [\App\Http\Controllers\Api\V1\Contracts\ContractExternalSignatureController::class, 'show']);
            Route::get('contracts/sign/{token}/document', [\App\Http\Controllers\Api\V1\Contracts\ContractExternalSignatureController::class, 'document']);
            Route::post('contracts/sign/{token}', [\App\Http\Controllers\Api\V1\Contracts\ContractExternalSignatureController::class, 'sign']);
            Route::post('contracts/decline/{token}', [\App\Http\Controllers\Api\V1\Contracts\ContractExternalSignatureController::class, 'decline']);
            Route::post('contracts/request-changes/{token}', [\App\Http\Controllers\Api\V1\Contracts\ContractExternalSignatureController::class, 'requestChanges']);
        });
    });

    Route::prefix('procurement')->group(function () {
        Route::get('supplier-categories/public', [\App\Http\Controllers\Api\V1\Procurement\SupplierCategoryController::class, 'publicIndex'])
            ->middleware('throttle:60,1');
        Route::post('suppliers/register', [\App\Http\Controllers\Api\V1\Procurement\SupplierRegistrationController::class, 'register'])->middleware('throttle:10,1');
        Route::post('suppliers/verify-email', [\App\Http\Controllers\Api\V1\Procurement\SupplierEmailVerificationController::class, 'verify'])->middleware('throttle:20,1');
        Route::get('external-rfq/{token}', [\App\Http\Controllers\Api\V1\Procurement\ExternalRfqController::class, 'show'])->middleware('throttle:20,1');
        Route::post('external-rfq/{token}/quote', [\App\Http\Controllers\Api\V1\Procurement\ExternalRfqController::class, 'submit'])->middleware('throttle:20,1');
        Route::get('notices', [\App\Http\Controllers\Api\V1\Procurement\PublicNoticeController::class, 'publicIndex'])
            ->middleware('throttle:60,1');
    });

    // Fleet telematics vendor webhook (token auth; never auto-creates vehicles).
    Route::post('fleet/telematics/webhook', \App\Http\Controllers\Api\V1\Fleet\FleetTelematicsWebhookController::class)
        ->middleware('throttle:60,1');

    // Google Calendar push notifications (token auth via GOOGLE_CALENDAR_WEBHOOK_SECRET).
    Route::post('assignments/google-calendar/webhook', \App\Http\Controllers\Api\V1\Assignments\AssignmentGoogleCalendarWebhookController::class)
        ->middleware('throttle:60,1');

    // Notifications Phase 2 — external recipient portal (opaque token; minimal content; expiry enforced).
    Route::get(
        'external/notifications/{token}',
        [\App\Http\Controllers\Api\V1\Notifications\ExternalNotificationPortalController::class, 'show']
    )->middleware('throttle:30,1');

    // Public document-signature verification (approved metadata only; opaque token).
    Route::get(
        'people-authority/public/verify-signature/{token}',
        [\App\Http\Controllers\Api\V1\PeopleAuthority\PeopleAuthorityPhase23Controller::class, 'publicVerify']
    )->middleware('throttle:30,1');

    // Document Service — public verify-by-hash + external share (approved metadata / time-limited only).
    Route::get('documents/public/verify/{hash}', [\App\Http\Controllers\Api\V1\Documents\DocumentServiceController::class, 'publicVerify'])
        ->middleware('throttle:30,1');
    Route::get('documents/public/share/{token}', [\App\Http\Controllers\Api\V1\Documents\DocumentServiceController::class, 'publicShare'])
        ->middleware('throttle:30,1');

    // Assignments ICS subscribe — opaque durable feed token (calendar clients cannot send Bearer).
    Route::get('assignments/calendar-subscribe/{token}', [\App\Http\Controllers\Api\V1\Assignments\AssignmentController::class, 'calendarSubscribe'])
        ->where('token', '[A-Za-z0-9._-]+')
        ->middleware('throttle:60,1');

    Route::get('parliament-connect/feed', [\App\Http\Controllers\Api\V1\ParliamentConnect\ParliamentConnectController::class, 'feed'])
        ->middleware('throttle:60,1');

    Route::get('public/assets/{token}', [\App\Http\Controllers\Api\V1\Assets\PublicAssetQrController::class, 'show'])
        ->where('token', '[A-Za-z0-9_-]+')
        ->middleware('throttle:60,1');
    Route::post('public/assets/{token}/found', [\App\Http\Controllers\Api\V1\Assets\PublicAssetQrController::class, 'found'])
        ->where('token', '[A-Za-z0-9_-]+')
        ->middleware('throttle:60,1');
    Route::get('public/purchase-orders/verify/{token}', [\App\Http\Controllers\Api\V1\Procurement\PublicPurchaseOrderVerifyController::class, 'show'])
        ->where('token', '[A-Za-z0-9._-]+')
        ->middleware('throttle:60,1');

    // Authenticated routes
    Route::middleware([
        'auth:sanctum',
        \App\Http\Middleware\EnsureSessionAuthIsValid::class,
        // Authenticated pages load several permission, notification and data
        // endpoints together. Keep abuse protection while allowing a normal
        // browser session to burst during navigation and initial hydration.
        'throttle:300,1',
        \App\Http\Middleware\SetRlsContext::class,
        // Opt-in: only acts on writes that carry an Idempotency-Key header.
        \App\Http\Middleware\EnforceIdempotencyKey::class,
    ])->group(function () {

        Route::prefix('auth')->group(function () {
            Route::post('logout', [AuthController::class, 'logout']);
            Route::post('logout-all', [AuthController::class, 'logoutAll']);
            Route::get('me', [AuthController::class, 'me']);
            Route::post('force-reset-password', [AuthController::class, 'forceResetPassword']);
            Route::post('device-token', [AuthController::class, 'registerDeviceToken']);
            Route::delete('device-token', [AuthController::class, 'unregisterDeviceToken']);
        });

        // User Profile (Self-Service)
        Route::get('profile', [\App\Http\Controllers\Api\V1\ProfileController::class, 'show']);
        Route::put('profile', [\App\Http\Controllers\Api\V1\ProfileController::class, 'update']);
        Route::patch('profile/idle-timeout', [\App\Http\Controllers\Api\V1\ProfileController::class, 'updateIdleTimeout']);
        Route::put('profile/password', [\App\Http\Controllers\Api\V1\ProfileController::class, 'updatePassword']);

        // Profile Change Requests (Self-Service Approval Workflow)
        Route::get('profile/change-request', [\App\Http\Controllers\Api\V1\ProfileChangeRequestController::class, 'show']);
        Route::post('profile/change-request', [\App\Http\Controllers\Api\V1\ProfileChangeRequestController::class, 'store']);
        Route::delete('profile/change-request/{changeRequest}', [\App\Http\Controllers\Api\V1\ProfileChangeRequestController::class, 'cancel']);

        // Profile Documents (Self-Service)
        Route::get('profile/documents', [\App\Http\Controllers\Api\V1\ProfileDocumentController::class, 'index']);
        Route::post('profile/documents', [\App\Http\Controllers\Api\V1\ProfileDocumentController::class, 'store']);
        Route::delete('profile/documents/{attachment}', [\App\Http\Controllers\Api\V1\ProfileDocumentController::class, 'destroy']);
        Route::get('profile/documents/{attachment}/download', [\App\Http\Controllers\Api\V1\ProfileDocumentController::class, 'download']);

        // Active Sessions (Self-Service)
        Route::get('profile/sessions', [\App\Http\Controllers\Api\V1\ProfileSessionController::class, 'index']);
        Route::delete('profile/sessions/others', [\App\Http\Controllers\Api\V1\ProfileSessionController::class, 'destroyOthers']);
        Route::delete('profile/sessions/{userSession}', [\App\Http\Controllers\Api\V1\ProfileSessionController::class, 'destroy']);

        // Two-Factor Authentication (TOTP)
        Route::get('profile/2fa/status', [\App\Http\Controllers\Api\V1\Profile\TwoFactorController::class, 'status']);
        Route::post('profile/2fa/enable', [\App\Http\Controllers\Api\V1\Profile\TwoFactorController::class, 'enable']);
        Route::post('profile/2fa/confirm', [\App\Http\Controllers\Api\V1\Profile\TwoFactorController::class, 'confirm']);
        Route::post('profile/2fa/disable', [\App\Http\Controllers\Api\V1\Profile\TwoFactorController::class, 'disable'])->middleware('throttle:5,1,mfa-sensitive');
        Route::post('profile/2fa/recovery-codes', [\App\Http\Controllers\Api\V1\Profile\TwoFactorController::class, 'regenerateRecoveryCodes'])->middleware('throttle:5,1,mfa-sensitive');
        Route::post('profile/2fa/verify', [\App\Http\Controllers\Api\V1\Profile\TwoFactorController::class, 'verify'])->middleware('throttle:5,1,mfa-sensitive');

        // Initial Setup Wizard (self-service, any authenticated user)
        Route::prefix('setup')->group(function () {
            Route::get('options', [\App\Http\Controllers\Api\V1\SetupController::class, 'options']);
            Route::put('identity', [\App\Http\Controllers\Api\V1\SetupController::class, 'updateIdentity']);
            Route::post('complete', [\App\Http\Controllers\Api\V1\SetupController::class, 'complete']);
        });

        // Email action processing — authenticated (token + user must match)
        Route::post('email-action/process',
            [\App\Http\Controllers\Api\V1\EmailAction\EmailActionController::class, 'process']
        );

        // User Notifications (in-app notification centre) + Phase 2/3 extensions
        // Cross-module "Needs my action" queue (always the caller's own items).
        Route::get('me/action-queue', [\App\Http\Controllers\Api\V1\ActionQueueController::class, 'index']);
        // Permission-filtered record search (references, suppliers, programmes, correspondence).
        Route::get('search/records', [\App\Http\Controllers\Api\V1\RecordSearchController::class, 'index']);

        Route::prefix('notifications')->group(function () {
            Route::get('/', [\App\Http\Controllers\Api\V1\Notifications\UserNotificationController::class, 'index']);
            Route::get('/unread-count', [\App\Http\Controllers\Api\V1\Notifications\UserNotificationController::class, 'unreadCount']);
            Route::get('/preferences', [\App\Http\Controllers\Api\V1\Notifications\UserNotificationController::class, 'preferences']);
            Route::put('/preferences', [\App\Http\Controllers\Api\V1\Notifications\UserNotificationController::class, 'updatePreferences']);
            Route::post('/read-all', [\App\Http\Controllers\Api\V1\Notifications\UserNotificationController::class, 'markAllRead']);

            // Phase 2/3 — register before /{id} catch-all
            Route::post('devices', [\App\Http\Controllers\Api\V1\Notifications\NotificationPhase23Controller::class, 'registerDevice']);
            Route::post('devices/refresh', [\App\Http\Controllers\Api\V1\Notifications\NotificationPhase23Controller::class, 'refreshDevice']);
            Route::delete('devices', [\App\Http\Controllers\Api\V1\Notifications\NotificationPhase23Controller::class, 'revokeDevice']);
            Route::get('deep-link', [\App\Http\Controllers\Api\V1\Notifications\NotificationPhase23Controller::class, 'deepLinkPreview']);
            Route::post('nl-search', [\App\Http\Controllers\Api\V1\Notifications\NotificationPhase23Controller::class, 'nlSearch']);
            Route::post('preference-suggestions', [\App\Http\Controllers\Api\V1\Notifications\NotificationPhase23Controller::class, 'preferenceSuggestions']);
            Route::post('predict-channels', [\App\Http\Controllers\Api\V1\Notifications\NotificationPhase23Controller::class, 'predictChannels']);
            Route::post('ai-suggestions/{id}/confirm', [\App\Http\Controllers\Api\V1\Notifications\NotificationPhase23Controller::class, 'confirmSuggestion']);
            Route::post('ack-campaigns', [\App\Http\Controllers\Api\V1\Notifications\NotificationPhase23Controller::class, 'createAckCampaign']);
            Route::post('ack-campaigns/{id}/activate', [\App\Http\Controllers\Api\V1\Notifications\NotificationPhase23Controller::class, 'activateAckCampaign']);
            Route::post('ack-campaigns/{id}/acknowledge', [\App\Http\Controllers\Api\V1\Notifications\NotificationPhase23Controller::class, 'acknowledgeCampaign']);
            Route::get('ack-campaigns/{id}/report', [\App\Http\Controllers\Api\V1\Notifications\NotificationPhase23Controller::class, 'ackReport']);
            Route::post('broadcasts', [\App\Http\Controllers\Api\V1\Notifications\NotificationPhase23Controller::class, 'createBroadcast']);
            Route::post('broadcasts/{id}/submit', [\App\Http\Controllers\Api\V1\Notifications\NotificationPhase23Controller::class, 'submitBroadcast']);
            Route::post('broadcasts/{id}/approve', [\App\Http\Controllers\Api\V1\Notifications\NotificationPhase23Controller::class, 'approveBroadcast']);
            Route::post('broadcasts/{id}/cancel', [\App\Http\Controllers\Api\V1\Notifications\NotificationPhase23Controller::class, 'cancelBroadcast']);

            Route::get('/{id}', [\App\Http\Controllers\Api\V1\Notifications\UserNotificationController::class, 'show']);
            Route::post('/{id}/read', [\App\Http\Controllers\Api\V1\Notifications\UserNotificationController::class, 'markRead']);
            Route::post('/{id}/unread', [\App\Http\Controllers\Api\V1\Notifications\UserNotificationController::class, 'markUnread']);
            Route::post('/{id}/acknowledge', [\App\Http\Controllers\Api\V1\Notifications\UserNotificationController::class, 'acknowledge']);
            Route::post('/{id}/archive', [\App\Http\Controllers\Api\V1\Notifications\UserNotificationController::class, 'archive']);
            Route::delete('/{id}', [\App\Http\Controllers\Api\V1\Notifications\UserNotificationController::class, 'destroy']);
        });

        // Platform Audit Trail (NOT Internal Audit module)
        Route::prefix('audit-events')->middleware('throttle:180,1')->group(function () {
            $c = \App\Http\Controllers\Api\V1\PlatformAudit\PlatformAuditController::class;
            Route::post('/', [$c, 'ingest']);
            Route::post('/batch', [$c, 'ingestBatch']);
            Route::get('/ingestion-status/{eventId}', [$c, 'ingestionStatus']);
            Route::get('/', [$c, 'index']);
            Route::get('/{id}', [$c, 'show']);
            Route::get('/{id}/related', [$c, 'related']);
        });
        Route::get('records/{type}/{id}/audit-history', [\App\Http\Controllers\Api\V1\PlatformAudit\PlatformAuditController::class, 'recordHistory']);
        Route::get('users/{id}/security-events', [\App\Http\Controllers\Api\V1\PlatformAudit\PlatformAuditController::class, 'userSecurityEvents']);
        Route::prefix('audit-integrity')->group(function () {
            $c = \App\Http\Controllers\Api\V1\PlatformAudit\PlatformAuditController::class;
            Route::get('checkpoints', [$c, 'checkpoints']);
            Route::post('verify', [$c, 'verify']);
            Route::get('reports/{id}', [$c, 'integrityReport']);
            Route::post('checkpoints', [$c, 'createCheckpoint']);
        });
        Route::prefix('audit-admin')->group(function () {
            $c = \App\Http\Controllers\Api\V1\PlatformAudit\PlatformAuditController::class;
            Route::get('ingestion-health', [$c, 'ingestionHealth']);
            Route::post('outbox/process', [$c, 'processOutbox']);
            Route::get('dead-letters', [$c, 'deadLetters']);
            Route::post('dead-letters/{id}/replay', [$c, 'replayDeadLetter']);
            Route::post('reconcile', [$c, 'reconcile']);
            Route::get('holds', [$c, 'holds']);
            Route::post('holds', [$c, 'placeHold']);
            Route::post('holds/{id}/release', [$c, 'releaseHold']);
            Route::get('event-types', [$c, 'eventTypes']);
            Route::get('monitoring-rules', [$c, 'monitoringRules']);
            Route::get('alerts', [$c, 'alerts']);
            Route::post('alerts/{id}/transition', [$c, 'transitionAlert']);
            Route::get('forensic-cases', [$c, 'forensicCases']);
            Route::post('forensic-cases', [$c, 'createForensicCase']);
            Route::post('forensic-cases/{id}/events', [$c, 'linkForensicEvent']);
            Route::post('forensic-cases/{id}/holds', [$c, 'forensicApplyHold']);
            Route::post('forensic-cases/{id}/evidence-package', [$c, 'sealEvidencePackage']);
            Route::get('forensic-packages/{id}/verify', [$c, 'verifyEvidencePackage']);
            Route::get('governance', [$c, 'governanceIndex']);
            Route::put('governance/{decision}', [$c, 'governanceUpdate']);
            Route::post('migrate-legacy', [$c, 'migrateLegacy']);
            Route::post('checkpoints', [$c, 'createCheckpoint']);
        });
        Route::prefix('security-alerts')->group(function () {
            $c = \App\Http\Controllers\Api\V1\PlatformAudit\PlatformAuditController::class;
            Route::get('/', [$c, 'alerts']);
            Route::get('{id}', [$c, 'showAlert']);
            Route::post('{id}/assign', [$c, 'assignAlert']);
            Route::post('{id}/classify', [$c, 'classifyAlert']);
            Route::post('{id}/create-incident', [$c, 'createIncidentForAlert']);
            Route::post('{id}/close', [$c, 'closeAlert']);
        });
        Route::prefix('forensic-cases')->group(function () {
            $c = \App\Http\Controllers\Api\V1\PlatformAudit\PlatformAuditController::class;
            Route::post('/', [$c, 'createForensicCase']);
            Route::post('{id}/events', [$c, 'linkForensicEvent']);
            Route::post('{id}/holds', [$c, 'forensicApplyHold']);
            Route::post('{id}/evidence-package', [$c, 'sealEvidencePackage']);
        });
        Route::get('forensic-packages/{id}/verify', [\App\Http\Controllers\Api\V1\PlatformAudit\PlatformAuditController::class, 'verifyEvidencePackage']);
        Route::prefix('notification-admin')->group(function () {
            Route::get('deliveries', [\App\Http\Controllers\Api\V1\Notifications\NotificationAdminController::class, 'deliveries']);
            Route::get('failures', [\App\Http\Controllers\Api\V1\Notifications\NotificationAdminController::class, 'failures']);
            Route::get('dead-letters', [\App\Http\Controllers\Api\V1\Notifications\NotificationAdminController::class, 'deadLetters']);
            Route::post('dead-letters/{id}/resolve', [\App\Http\Controllers\Api\V1\Notifications\NotificationAdminController::class, 'resolveDeadLetter']);
            Route::post('deliveries/{id}/retry', [\App\Http\Controllers\Api\V1\Notifications\NotificationAdminController::class, 'retry']);
            Route::post('deliveries/{id}/suppress', [\App\Http\Controllers\Api\V1\Notifications\NotificationAdminController::class, 'suppress']);
            Route::get('audit', [\App\Http\Controllers\Api\V1\Notifications\NotificationAdminController::class, 'audit']);
            Route::get('analytics', [\App\Http\Controllers\Api\V1\Notifications\NotificationPhase23Controller::class, 'analytics']);
            Route::get('fatigue', [\App\Http\Controllers\Api\V1\Notifications\NotificationPhase23Controller::class, 'fatigue']);
            Route::post('external-tokens', [\App\Http\Controllers\Api\V1\Notifications\NotificationPhase23Controller::class, 'issueExternalToken']);
            Route::get('maintenance', [\App\Http\Controllers\Api\V1\Notifications\NotificationPhase23Controller::class, 'listMaintenance']);
            Route::post('maintenance', [\App\Http\Controllers\Api\V1\Notifications\NotificationPhase23Controller::class, 'scheduleMaintenance']);
            Route::get('ai/guards', [\App\Http\Controllers\Api\V1\Notifications\NotificationPhase23Controller::class, 'aiGuards']);
            Route::get('governance', [\App\Http\Controllers\Api\V1\Notifications\NotificationGovernanceController::class, 'index']);
            Route::put('governance/{decision}', [\App\Http\Controllers\Api\V1\Notifications\NotificationGovernanceController::class, 'update']);
        });

        require __DIR__.'/api/documents.php';

        Route::get('dashboard/stats', [\App\Http\Controllers\Api\V1\DashboardController::class, 'stats']);
        Route::get('dashboard/upcoming-social', [\App\Http\Controllers\Api\V1\DashboardController::class, 'upcomingSocial']);

        // Access-control navigation + PDP check (authenticated)
        Route::get('access/navigation', [\App\Http\Controllers\Api\V1\AccessControl\AccessGovernanceController::class, 'navigation']);
        Route::get('access/effective', [\App\Http\Controllers\Api\V1\AccessControl\AccessGovernanceController::class, 'effective']);
        Route::post('access/authorize', [\App\Http\Controllers\Api\V1\AccessControl\AccessGovernanceController::class, 'authorizeCheck']);
        Route::post('access/requests', [\App\Http\Controllers\Api\V1\AccessControl\AccessGovernanceController::class, 'storeAccessRequest']);

        Route::get('lookups', [\App\Http\Controllers\Api\V1\LookupsController::class, 'index']);
        Route::get('tenant-users', [\App\Http\Controllers\Api\V1\TenantUsersController::class, 'index']);

        // Admin SPA: many parallel GETs (user edit loads users, departments, roles, …).
        // The previous throttle:20,1 capped the whole prefix and caused frequent 429s.
        Route::prefix('admin')->middleware('throttle:180,1')->group(function () {
            // Admin Console, Platform Configuration & Operational Control (Phase 1)
            Route::get('dashboard', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'dashboard']);
            Route::get('platform-status', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'platformStatus']);
            Route::get('modules', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'modules']);
            Route::get('modules/{id}', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'showModule']);
            Route::post('modules/{id}/change-status', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'changeModuleStatus']);

            Route::get('configurations', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'configurations']);
            Route::post('configurations/{id}/change-requests', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'proposeConfigurationChange']);
            Route::post('configuration-changes/{id}/validate', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'validateConfigurationChange']);
            Route::post('configuration-changes/{id}/review', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'reviewConfigurationChange']);
            Route::post('configuration-changes/{id}/approve', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'approveConfigurationChange']);
            Route::post('configuration-changes/{id}/schedule', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'scheduleConfigurationChange']);
            Route::post('configuration-changes/{id}/activate', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'activateConfigurationChange']);
            Route::post('configuration-changes/{id}/rollback', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'rollbackConfigurationChange']);

            Route::get('reference-data', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'referenceData']);
            Route::post('reference-data/{set}/items', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'storeReferenceItem']);
            Route::put('reference-data/items/{id}', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'updateReferenceItem']);
            Route::post('reference-data/items/{id}/deprecate', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'deprecateReferenceItem']);
            Route::post('reference-data/{set}/import', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'importReferenceData']);

            Route::get('feature-flags', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'featureFlags']);
            Route::post('feature-flags', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'storeFeatureFlag']);
            Route::post('feature-flags/{id}/approve', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'approveFeatureFlag']);
            Route::post('feature-flags/{id}/activate', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'activateFeatureFlag']);
            Route::post('feature-flags/{id}/disable', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'disableFeatureFlag']);
            Route::get('calendars', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'calendars']);
            Route::get('numbering-schemes', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'numberingSchemes']);
            Route::get('localisation', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'localisation']);
            Route::get('integrations', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'integrations']);

            Route::get('jobs', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'jobs']);
            Route::get('job-runs', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'jobRuns']);
            Route::post('jobs/{id}/run', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'runJob']);
            Route::get('queues', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'queues']);
            Route::get('dead-letters', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'deadLetters']);
            Route::post('dead-letters/{id}/replay', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'replayDeadLetter']);
            Route::post('dead-letters/{id}/resolve', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'resolveDeadLetter']);
            Route::get('system-health', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'systemHealth']);

            Route::post('maintenance-windows', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'createMaintenanceWindow']);
            Route::post('maintenance-windows/{id}/approve', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'approveMaintenanceWindow']);
            Route::post('maintenance-windows/{id}/start', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'startMaintenanceWindow']);
            Route::post('maintenance-windows/{id}/complete', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'completeMaintenanceWindow']);
            Route::post('system-banners', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'createSystemBanner']);

            Route::get('data-quality/issues', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'dataQualityIssues']);
            Route::post('data-corrections', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'createDataCorrection']);
            Route::post('data-corrections/{id}/approve', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'approveDataCorrection']);
            Route::post('data-corrections/{id}/execute', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'executeDataCorrection']);

            Route::get('backups', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'backups']);
            Route::post('restore-requests', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'requestRestore']);
            Route::get('restore-requests', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'restoreRequests']);
            Route::post('restore-requests/{id}/approve', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'approveRestore']);
            Route::post('restore-requests/{id}/execute', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'executeRestore']);
            Route::get('imports', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'imports']);
            Route::get('migrations', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'migrations']);
            Route::post('support-sessions', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'createSupportSession']);
            Route::post('support-sessions/{id}/approve', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'approveSupportSession']);
            Route::post('support-sessions/{id}/close', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'closeSupportSession']);
            Route::post('break-glass', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'requestBreakGlass']);
            Route::post('break-glass/{id}/approve', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'approveBreakGlass']);
            Route::post('break-glass/{id}/close', [\App\Http\Controllers\Api\V1\Admin\AdminConsoleController::class, 'closeBreakGlass']);

            // Users
            Route::post('users/bulk-deactivate', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'bulkDeactivate']);
            Route::apiResource('users', \App\Http\Controllers\Api\V1\Admin\UsersController::class);
            Route::post('users/{user}/reactivate', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'reactivate']);
            Route::post('users/{user}/change-password', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'changePassword']);
            Route::post('users/{user}/password-reset', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'sendPasswordReset']);
            Route::post('users/{user}/resend-invitation', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'resendInvitation']);
            Route::patch('users/{user}/status', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'updateStatus']);
            Route::patch('users/{user}/roles', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'updateRoles']);
            Route::post('users/role-sync-requests/{syncRequest}/approve', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'approveRoleSync']);
            Route::post('users/{user}/mfa-reset', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'mfaReset']);
            Route::post('users/{user}/revoke-sessions', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'revokeSessions']);
            Route::get('users/{user}/audit', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'audit']);
            Route::get('access-requests', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'accessRequests']);
            Route::post('access-requests/{accessRequest}/approve', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'approveAccessRequest']);
            Route::post('access-requests/{accessRequest}/reject', [\App\Http\Controllers\Api\V1\Admin\UsersController::class, 'rejectAccessRequest']);

            // Admin: user profile documents
            Route::get('users/{user}/documents', [\App\Http\Controllers\Api\V1\ProfileDocumentController::class, 'adminIndex']);
            Route::post('users/{user}/documents', [\App\Http\Controllers\Api\V1\ProfileDocumentController::class, 'adminStore']);
            Route::delete('users/{user}/documents/{attachment}', [\App\Http\Controllers\Api\V1\ProfileDocumentController::class, 'adminDestroy']);
            Route::get('users/{user}/documents/{attachment}/download', [\App\Http\Controllers\Api\V1\ProfileDocumentController::class, 'adminDownload']);

            // Departments
            Route::apiResource('departments', \App\Http\Controllers\Api\V1\Admin\DepartmentsController::class)
                ->only(['index', 'store', 'update', 'show', 'destroy']);

            // Portfolios
            Route::apiResource('portfolios', \App\Http\Controllers\Api\V1\Admin\PortfoliosController::class);

            // Roles & Permissions (CRUD + assign permissions; assign role to user is via PUT /users/{id})
            Route::get('roles', [\App\Http\Controllers\Api\V1\Admin\RolesController::class, 'index']);
            Route::post('roles', [\App\Http\Controllers\Api\V1\Admin\RolesController::class, 'store']);
            Route::get('roles/{role}', [\App\Http\Controllers\Api\V1\Admin\RolesController::class, 'show']);
            Route::put('roles/{role}', [\App\Http\Controllers\Api\V1\Admin\RolesController::class, 'update']);
            Route::delete('roles/{role}', [\App\Http\Controllers\Api\V1\Admin\RolesController::class, 'destroy']);
            Route::put('roles/{role}/permissions', [\App\Http\Controllers\Api\V1\Admin\RolesController::class, 'syncPermissions']);

            // Access Control Governance (PRD Phases 1–6)
            Route::prefix('access')->group(function () {
                $ac = \App\Http\Controllers\Api\V1\AccessControl\AccessGovernanceController::class;
                Route::get('registry', [$ac, 'registry']);
                Route::get('coverage', [$ac, 'coverage']);
                Route::get('roles', [$ac, 'roleCatalogue']);
                Route::post('roles', [$ac, 'createRoleDraft']);
                Route::post('roles/{catalogue}/publish', [$ac, 'publishRoleVersion']);
                Route::get('users/{user}/profile', [$ac, 'userProfile']);
                Route::post('users/{user}/simulate', [$ac, 'simulate']);
                Route::post('users/{user}/grants', [$ac, 'grantPermission']);
                Route::post('grants/{grant}/approve', [$ac, 'approveGrant']);
                Route::post('grants/{grant}/reject', [$ac, 'rejectGrant']);
                Route::post('users/{user}/denials', [$ac, 'denyPermission']);
                Route::post('users/{user}/role-versions/{version}', [$ac, 'assignRoleVersion']);
                Route::post('role-assignments/{assignment}/approve', [$ac, 'approveRoleAssignment']);
                Route::get('explore', [$ac, 'explore']);
                Route::get('requests', [$ac, 'accessRequests']);
                Route::post('requests', [$ac, 'storeAccessRequest']);
                Route::post('requests/{accessRequest}/decide', [$ac, 'decideAccessRequest']);
                Route::get('reviews', [$ac, 'reviewCampaigns']);
                Route::post('reviews', [$ac, 'storeReviewCampaign']);
                Route::post('reviews/items/{item}/decide', [$ac, 'decideReviewItem']);
                Route::get('governance', [$ac, 'governanceChecklist']);
                Route::put('governance/{decision}', [$ac, 'governanceUpdate']);
                Route::get('cutover', [$ac, 'cutoverStatus']);
                Route::put('cutover/freeze', [$ac, 'cutoverFreeze']);
                Route::post('cutover/revoke-obsolete', [$ac, 'cutoverRevokeObsolete']);
            });

            // Payslips (list, show, download, upload, delete, refresh auto-fill)
            Route::get('payslips', [\App\Http\Controllers\Api\V1\Admin\PayslipController::class, 'index']);
            Route::post('payslips', [\App\Http\Controllers\Api\V1\Admin\PayslipController::class, 'store']);
            Route::post('payslips/match', [\App\Http\Controllers\Api\V1\Admin\PayslipController::class, 'match']);
            Route::post('payslips/distribute', [\App\Http\Controllers\Api\V1\Admin\PayslipController::class, 'distribute']);
            Route::get('payslips/directory', [\App\Http\Controllers\Api\V1\Admin\PayslipController::class, 'directory']);
            Route::get('payslips/period-coverage', [\App\Http\Controllers\Api\V1\Admin\PayslipController::class, 'periodCoverage']);
            Route::get('payslips/{payslip}', [\App\Http\Controllers\Api\V1\Admin\PayslipController::class, 'show']);
            Route::get('payslips/{payslip}/download', [\App\Http\Controllers\Api\V1\Admin\PayslipController::class, 'download']);
            Route::post('payslips/{payslip}/refresh', [\App\Http\Controllers\Api\V1\Admin\PayslipController::class, 'refresh']);
            Route::delete('payslips/{payslip}', [\App\Http\Controllers\Api\V1\Admin\PayslipController::class, 'destroy']);

            // Payslip line configs (per-employee)
            Route::get('payslip-configs', [\App\Http\Controllers\Api\V1\Admin\PayslipConfigController::class, 'index']);
            Route::post('payslip-configs/defaults', [\App\Http\Controllers\Api\V1\Admin\PayslipConfigController::class, 'defaults']);
            Route::post('payslip-configs', [\App\Http\Controllers\Api\V1\Admin\PayslipConfigController::class, 'store']);
            Route::put('payslip-configs/{config}', [\App\Http\Controllers\Api\V1\Admin\PayslipConfigController::class, 'update']);
            Route::delete('payslip-configs/{config}', [\App\Http\Controllers\Api\V1\Admin\PayslipConfigController::class, 'destroy']);

            // Employee salary grade/notch assignments
            Route::get('salary-assignments', [\App\Http\Controllers\Api\V1\Admin\EmployeeSalaryAssignmentController::class, 'index']);
            Route::post('salary-assignments', [\App\Http\Controllers\Api\V1\Admin\EmployeeSalaryAssignmentController::class, 'store']);
            Route::put('salary-assignments/{salaryAssignment}', [\App\Http\Controllers\Api\V1\Admin\EmployeeSalaryAssignmentController::class, 'update']);
            Route::delete('salary-assignments/{salaryAssignment}', [\App\Http\Controllers\Api\V1\Admin\EmployeeSalaryAssignmentController::class, 'destroy']);

            // Timesheet projects (admin CRUD)
            Route::get('timesheet-projects', [\App\Http\Controllers\Api\V1\Admin\TimesheetProjectController::class, 'index']);
            Route::post('timesheet-projects', [\App\Http\Controllers\Api\V1\Admin\TimesheetProjectController::class, 'store']);
            Route::put('timesheet-projects/{timesheet_project}', [\App\Http\Controllers\Api\V1\Admin\TimesheetProjectController::class, 'update']);
            Route::delete('timesheet-projects/{timesheet_project}', [\App\Http\Controllers\Api\V1\Admin\TimesheetProjectController::class, 'destroy']);

            // Holiday Calendars (admin CRUD)
            Route::get('holiday-calendars', [\App\Http\Controllers\Api\V1\Admin\HolidayCalendarController::class, 'index']);
            Route::post('holiday-calendars', [\App\Http\Controllers\Api\V1\Admin\HolidayCalendarController::class, 'store']);
            Route::get('holiday-calendars/{holidayCalendar}', [\App\Http\Controllers\Api\V1\Admin\HolidayCalendarController::class, 'show']);
            Route::put('holiday-calendars/{holidayCalendar}', [\App\Http\Controllers\Api\V1\Admin\HolidayCalendarController::class, 'update']);
            Route::delete('holiday-calendars/{holidayCalendar}', [\App\Http\Controllers\Api\V1\Admin\HolidayCalendarController::class, 'destroy']);
            Route::get('holiday-calendars/{holidayCalendar}/dates', [\App\Http\Controllers\Api\V1\Admin\HolidayCalendarController::class, 'listDates']);
            Route::post('holiday-calendars/{holidayCalendar}/dates', [\App\Http\Controllers\Api\V1\Admin\HolidayCalendarController::class, 'bulkUpsertDates']);
            Route::delete('holiday-calendars/{holidayCalendar}/dates/{holidayDate}', [\App\Http\Controllers\Api\V1\Admin\HolidayCalendarController::class, 'destroyDate']);

            // Audit Logs
            Route::get('audit-logs', [\App\Http\Controllers\Api\V1\Admin\AuditLogController::class, 'index']);

            // Ledger Verifications
            Route::get('audit/ledger/verifications', [\App\Http\Controllers\Api\V1\Audit\LedgerVerificationController::class, 'index']);
            Route::post('audit/ledger/verify', [\App\Http\Controllers\Api\V1\Audit\LedgerVerificationController::class, 'store']);
            Route::get('audit/ledger/verifications/{ledgerVerification}', [\App\Http\Controllers\Api\V1\Audit\LedgerVerificationController::class, 'show']);

            // System Settings
            Route::get('settings', [\App\Http\Controllers\Api\V1\Admin\SettingsController::class, 'index']);
            Route::put('settings', [\App\Http\Controllers\Api\V1\Admin\SettingsController::class, 'update']);
            Route::get('email', [\App\Http\Controllers\Api\V1\Admin\AdminEmailSettingsController::class, 'show']);
            Route::put('email', [\App\Http\Controllers\Api\V1\Admin\AdminEmailSettingsController::class, 'update']);
            Route::get('operator-credentials', \App\Http\Controllers\Api\V1\Admin\OperatorCredentialStatusController::class);

            // Notification Templates
            Route::get('notification-templates', [\App\Http\Controllers\Api\V1\Admin\NotificationTemplateController::class, 'index']);
            Route::put('notification-templates', [\App\Http\Controllers\Api\V1\Admin\NotificationTemplateController::class, 'updateByTrigger']);
            Route::post('notification-templates/test-send', [\App\Http\Controllers\Api\V1\Admin\NotificationTemplateController::class, 'testSend']);
            Route::delete('notification-templates', [\App\Http\Controllers\Api\V1\Admin\NotificationTemplateController::class, 'resetToDefault']);

            // Positions (establishment register)
            Route::apiResource('positions', \App\Http\Controllers\Api\V1\Admin\PositionController::class);
            Route::post('positions/{position}/assign', [\App\Http\Controllers\Api\V1\Admin\PositionController::class, 'assign']);

            // HR Settings — Master Data & Rules
            Route::prefix('hr-settings')->group(function () {
                // Job Families
                Route::apiResource('job-families', \App\Http\Controllers\Api\V1\HrSettings\JobFamilyController::class)
                    ->names('hr-settings.job-families');

                // Grade Bands (full lifecycle)
                Route::apiResource('grade-bands', \App\Http\Controllers\Api\V1\HrSettings\GradeBandController::class)
                    ->names('hr-settings.grade-bands');
                Route::post('grade-bands/{gradeBand}/submit', [\App\Http\Controllers\Api\V1\HrSettings\GradeBandController::class, 'submit'])->name('hr-settings.grade-bands.submit');
                Route::post('grade-bands/{gradeBand}/approve', [\App\Http\Controllers\Api\V1\HrSettings\GradeBandController::class, 'approve'])->name('hr-settings.grade-bands.approve');
                Route::post('grade-bands/{gradeBand}/publish', [\App\Http\Controllers\Api\V1\HrSettings\GradeBandController::class, 'publish'])->name('hr-settings.grade-bands.publish');
                Route::post('grade-bands/{gradeBand}/archive', [\App\Http\Controllers\Api\V1\HrSettings\GradeBandController::class, 'archive'])->name('hr-settings.grade-bands.archive');
                Route::post('grade-bands/{gradeBand}/new-version', [\App\Http\Controllers\Api\V1\HrSettings\GradeBandController::class, 'newVersion'])->name('hr-settings.grade-bands.new-version');
                Route::get('grade-bands/{gradeBand}/impact', [\App\Http\Controllers\Api\V1\HrSettings\GradeBandController::class, 'impactCheck'])->name('hr-settings.grade-bands.impact');

                // Salary Scales (full lifecycle)
                Route::apiResource('salary-scales', \App\Http\Controllers\Api\V1\HrSettings\SalaryScaleController::class)
                    ->names('hr-settings.salary-scales');
                Route::post('salary-scales/{salaryScale}/submit', [\App\Http\Controllers\Api\V1\HrSettings\SalaryScaleController::class, 'submit'])->name('hr-settings.salary-scales.submit');
                Route::post('salary-scales/{salaryScale}/approve', [\App\Http\Controllers\Api\V1\HrSettings\SalaryScaleController::class, 'approve'])->name('hr-settings.salary-scales.approve');
                Route::post('salary-scales/{salaryScale}/publish', [\App\Http\Controllers\Api\V1\HrSettings\SalaryScaleController::class, 'publish'])->name('hr-settings.salary-scales.publish');

                // Phase 2
                Route::apiResource('contract-types', \App\Http\Controllers\Api\V1\HrSettings\ContractTypeController::class)
                    ->names('hr-settings.contract-types');
                Route::apiResource('leave-profiles', \App\Http\Controllers\Api\V1\HrSettings\LeaveProfileController::class)
                    ->names('hr-settings.leave-profiles');
                Route::apiResource('allowance-profiles', \App\Http\Controllers\Api\V1\HrSettings\AllowanceProfileController::class)
                    ->names('hr-settings.allowance-profiles');

                // Phase 3
                Route::apiResource('appraisal-templates', \App\Http\Controllers\Api\V1\HrSettings\AppraisalTemplateController::class)
                    ->names('hr-settings.appraisal-templates');
                Route::post('personnel-file-sections/reorder', [\App\Http\Controllers\Api\V1\HrSettings\PersonnelFileSectionController::class, 'reorder'])
                    ->name('hr-settings.personnel-file-sections.reorder');
                Route::apiResource('personnel-file-sections', \App\Http\Controllers\Api\V1\HrSettings\PersonnelFileSectionController::class)
                    ->names('hr-settings.personnel-file-sections');
                Route::apiResource('approval-matrix', \App\Http\Controllers\Api\V1\HrSettings\ApprovalMatrixController::class)
                    ->names('hr-settings.approval-matrix');
            });
        });

        // Module routes will be added here per module

        require __DIR__.'/api/travel.php';

        // Imprest Module
        Route::prefix('imprest')->group(function () {
            Route::apiResource('requests', \App\Http\Controllers\Api\V1\Imprest\ImprestController::class)
                ->parameters(['requests' => 'imprestRequest'])
                ->names('imprest.requests');
            Route::post('requests/{imprestRequest}/submit', [\App\Http\Controllers\Api\V1\Imprest\ImprestController::class, 'submit']);
            Route::post('requests/{imprestRequest}/approve', [\App\Http\Controllers\Api\V1\Imprest\ImprestController::class, 'approve']);
            Route::post('requests/{imprestRequest}/reject', [\App\Http\Controllers\Api\V1\Imprest\ImprestController::class, 'reject']);
            Route::post('requests/{imprestRequest}/return', [\App\Http\Controllers\Api\V1\Imprest\ImprestController::class, 'returnForCorrection']);
            Route::post('requests/{imprestRequest}/withdraw', [\App\Http\Controllers\Api\V1\Imprest\ImprestController::class, 'withdraw']);
            Route::post('requests/{imprestRequest}/resubmit', [\App\Http\Controllers\Api\V1\Imprest\ImprestController::class, 'resubmit']);
            Route::post('requests/{imprestRequest}/retire', [\App\Http\Controllers\Api\V1\Imprest\ImprestController::class, 'retire']);
            Route::get('requests/{imprestRequest}/certificate', [\App\Http\Controllers\Api\V1\Imprest\ImprestController::class, 'certificate']);
        });

        // Leave Module
        Route::pattern('leaveRequest', '[0-9]+');
        require __DIR__.'/api/leave.php';

        // Shared calendar/working-days calculation (any module's date-range picker)
        Route::prefix('calendar')->group(function () {
            Route::post('working-days', [\App\Http\Controllers\Api\V1\Shared\CalendarController::class, 'workingDays']);
        });

        require __DIR__.'/api/procurement.php';

        require __DIR__.'/api/budget.php';

        require __DIR__.'/api/finance.php';

        // HR - Timesheets & Summary
        Route::prefix('hr')->group(function () {
            Route::get('summary', [\App\Http\Controllers\Api\V1\Hr\HrSummaryController::class, 'summary']);

            Route::get('imports', [\App\Http\Controllers\Api\V1\Hr\HrVipImportController::class, 'index']);
            Route::post('imports', [\App\Http\Controllers\Api\V1\Hr\HrVipImportController::class, 'store']);
            Route::get('imports/{hrVipImportBatch}', [\App\Http\Controllers\Api\V1\Hr\HrVipImportController::class, 'show']);
            Route::get('imports/{hrVipImportBatch}/preview', [\App\Http\Controllers\Api\V1\Hr\HrVipImportController::class, 'preview']);
            Route::post('imports/{hrVipImportBatch}/commit', [\App\Http\Controllers\Api\V1\Hr\HrVipImportController::class, 'commit']);

            // Dry-run source staging (system admin only) — upload the real historical
            // migration source files through the app instead of needing SSH access.
            Route::get('dry-run-source', [\App\Http\Controllers\Api\V1\Hr\HrDryRunSourceController::class, 'index']);
            Route::post('dry-run-source', [\App\Http\Controllers\Api\V1\Hr\HrDryRunSourceController::class, 'store']);
            Route::delete('dry-run-source', [\App\Http\Controllers\Api\V1\Hr\HrDryRunSourceController::class, 'clear']);
            Route::delete('dry-run-source/{filename}', [\App\Http\Controllers\Api\V1\Hr\HrDryRunSourceController::class, 'destroy']);

            // Payslip salary confirmation (HR only)
            Route::post('payslips/{payslip}/confirm', [\App\Http\Controllers\Api\V1\Hr\PayslipConfirmationController::class, 'confirm']);

            // Profile Change Approval (HR)
            Route::get('profile-requests', [\App\Http\Controllers\Api\V1\Hr\ProfileRequestController::class, 'index']);
            Route::get('profile-requests/{profileChangeRequest}', [\App\Http\Controllers\Api\V1\Hr\ProfileRequestController::class, 'show']);
            Route::post('profile-requests/{profileChangeRequest}/approve', [\App\Http\Controllers\Api\V1\Hr\ProfileRequestController::class, 'approve']);
            Route::post('profile-requests/{profileChangeRequest}/reject', [\App\Http\Controllers\Api\V1\Hr\ProfileRequestController::class, 'reject']);
            Route::get('timesheets', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'index']);
            Route::get('timesheets/import/template', [\App\Http\Controllers\Api\V1\Hr\TimesheetImportController::class, 'template']);
            Route::get('timesheets/imports', [\App\Http\Controllers\Api\V1\Hr\TimesheetImportController::class, 'index']);
            Route::post('timesheets/imports', [\App\Http\Controllers\Api\V1\Hr\TimesheetImportController::class, 'store']);
            Route::get('timesheets/imports/{timesheetImportBatch}', [\App\Http\Controllers\Api\V1\Hr\TimesheetImportController::class, 'show']);
            Route::post('timesheets/imports/{timesheetImportBatch}/map', [\App\Http\Controllers\Api\V1\Hr\TimesheetImportController::class, 'map']);
            Route::post('timesheets/imports/{timesheetImportBatch}/validate', [\App\Http\Controllers\Api\V1\Hr\TimesheetImportController::class, 'validateBatch']);
            Route::get('timesheets/imports/{timesheetImportBatch}/preview', [\App\Http\Controllers\Api\V1\Hr\TimesheetImportController::class, 'preview']);
            Route::get('timesheets/imports/{timesheetImportBatch}/failures', [\App\Http\Controllers\Api\V1\Hr\TimesheetImportController::class, 'failures']);
            Route::post('timesheets/imports/{timesheetImportBatch}/confirm', [\App\Http\Controllers\Api\V1\Hr\TimesheetImportController::class, 'confirm']);
            Route::post('timesheets/imports/{timesheetImportBatch}/verify', [\App\Http\Controllers\Api\V1\Hr\TimesheetImportController::class, 'verify']);
            Route::post('timesheets/imports/{timesheetImportBatch}/rollback', [\App\Http\Controllers\Api\V1\Hr\TimesheetImportController::class, 'rollback']);
            Route::post('timesheets/imports/{timesheetImportBatch}/reverse', [\App\Http\Controllers\Api\V1\Hr\TimesheetImportController::class, 'reverse']);
            Route::get('timesheets/imports/{timesheetImportBatch}/file', [\App\Http\Controllers\Api\V1\Hr\TimesheetImportController::class, 'file']);
            Route::get('timesheets/import-mappings', [\App\Http\Controllers\Api\V1\Hr\TimesheetImportController::class, 'mappings']);
            Route::post('timesheets/import-mappings', [\App\Http\Controllers\Api\V1\Hr\TimesheetImportController::class, 'storeMapping']);
            Route::post('timesheets/import-templates', [\App\Http\Controllers\Api\V1\Hr\TimesheetImportController::class, 'storeTemplate']);
            Route::post('timesheets/import', [\App\Http\Controllers\Api\V1\Hr\TimesheetImportController::class, 'store']);
            Route::get('timesheets/team', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'team']);
            Route::get('timesheets/leave-days', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'leaveDays']);
            Route::get('timesheets/travel-days', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'travelDays']);
            Route::get('timesheets/holiday-dates', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'holidayDates']);
            Route::get('timesheets/templates', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'templates']);
            Route::get('timesheets/projects', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'projects']);
            Route::post('timesheets/templates', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'storeTemplate']);
            Route::put('timesheets/templates/{template}', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'updateTemplate']);
            Route::post('timesheets/templates/{template}/deactivate', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'deactivateTemplate']);
            Route::post('timesheets/templates/{template}/apply', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'applyTemplate']);
            Route::get('timesheets/expected-hours', [\App\Http\Controllers\Api\V1\Hr\WorkScheduleController::class, 'expectedHours']);
            Route::get('timesheets/capacity-analytics', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'capacityAnalytics']);
            Route::post('timesheets/attendance/clock', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'clockAttendance']);
            Route::get('timesheets/periods', [\App\Http\Controllers\Api\V1\Hr\WorkScheduleController::class, 'periods']);
            Route::post('timesheets/periods/{timesheetPeriod}/close', [\App\Http\Controllers\Api\V1\Hr\WorkScheduleController::class, 'closePeriod']);
            Route::get('timesheets/schedules', [\App\Http\Controllers\Api\V1\Hr\WorkScheduleController::class, 'index']);
            Route::post('timesheets/schedules', [\App\Http\Controllers\Api\V1\Hr\WorkScheduleController::class, 'store']);
            Route::post('timesheets/schedules/assign', [\App\Http\Controllers\Api\V1\Hr\WorkScheduleController::class, 'assign']);
            Route::post('timesheets/payroll-exports', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'exportPayroll']);
            Route::get('timesheets/payroll-exports', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'listPayrollExports']);
            Route::post('timesheets/payroll-exports/stage', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'stagePayrollExport']);
            Route::get('timesheets/payroll-exports/{payrollExport}/download', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'downloadPayrollExport']);
            Route::get('timesheets/{timesheet}/export', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'export'])->whereNumber('timesheet');
            Route::get('timesheets/{timesheet}', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'show'])->whereNumber('timesheet');
            Route::post('timesheets', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'store']);
            Route::put('timesheets/{timesheet}', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'update'])->whereNumber('timesheet');
            Route::post('timesheets/{timesheet}/submit', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'submit'])->whereNumber('timesheet');
            Route::post('timesheets/{timesheet}/return', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'returnTimesheet'])->whereNumber('timesheet');
            Route::post('timesheets/{timesheet}/approve', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'approve'])->whereNumber('timesheet');
            Route::post('timesheets/{timesheet}/reject', [\App\Http\Controllers\Api\V1\Hr\TimesheetController::class, 'reject'])->whereNumber('timesheet');

            // Overtime requisitions / actuals / settlement (PRD §89)
            Route::get('overtime-requisitions', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'index']);
            Route::post('overtime-requisitions', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'store']);
            Route::get('overtime-requisitions/{overtimeRequisition}', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'show']);
            Route::post('overtime-requisitions/{overtimeRequisition}/submit', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'submit']);
            Route::post('overtime-requisitions/{overtimeRequisition}/recommend', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'recommend']);
            Route::post('overtime-requisitions/{overtimeRequisition}/approve', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'approve']);
            Route::post('overtime-requisitions/{overtimeRequisition}/reject', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'reject']);
            Route::post('overtime-requisitions/{overtimeRequisition}/actuals', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'recordActual']);
            Route::post('overtime-actuals/{overtimeActual}/hr-validate', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'hrValidate']);
            Route::post('overtime-actuals/{overtimeActual}/send-to-payroll', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'sendToPayroll']);
            Route::post('overtime-actuals/{overtimeActual}/send-to-toil', [\App\Http\Controllers\Api\V1\Hr\OvertimeController::class, 'sendToToil']);
            Route::get('incidents', [\App\Http\Controllers\Api\V1\Hr\HrIncidentController::class, 'index']);
            Route::post('incidents', [\App\Http\Controllers\Api\V1\Hr\HrIncidentController::class, 'store']);
            Route::get('incidents/{hrIncident}', [\App\Http\Controllers\Api\V1\Hr\HrIncidentController::class, 'show']);
            Route::put('incidents/{hrIncident}', [\App\Http\Controllers\Api\V1\Hr\HrIncidentController::class, 'update']);
            Route::delete('incidents/{hrIncident}', [\App\Http\Controllers\Api\V1\Hr\HrIncidentController::class, 'destroy']);
        });

        // HR - Work Assignments
        Route::prefix('hr')->group(function () {
            Route::get('assignments/stats', [\App\Http\Controllers\Api\V1\Hr\WorkAssignmentController::class, 'stats']);
            Route::apiResource('assignments', \App\Http\Controllers\Api\V1\Hr\WorkAssignmentController::class)
                ->only(['index', 'store', 'show', 'update'])
                ->parameters(['assignment' => 'workAssignment'])
                ->names('hr.assignments');
            Route::post('assignments/{workAssignment}/updates', [\App\Http\Controllers\Api\V1\Hr\WorkAssignmentController::class, 'addUpdate']);
            Route::post('assignments/{workAssignment}/start', [\App\Http\Controllers\Api\V1\Hr\WorkAssignmentController::class, 'start']);
            Route::post('assignments/{workAssignment}/complete', [\App\Http\Controllers\Api\V1\Hr\WorkAssignmentController::class, 'complete']);
        });

        // HR - Performance Tracker
        Route::prefix('hr')->group(function () {
            Route::get('performance/overview', [\App\Http\Controllers\Api\V1\Hr\PerformanceTrackerController::class, 'overview']);
            Route::get('performance/team', [\App\Http\Controllers\Api\V1\Hr\PerformanceTrackerController::class, 'team']);
            Route::get('performance', [\App\Http\Controllers\Api\V1\Hr\PerformanceTrackerController::class, 'index']);
            Route::post('performance', [\App\Http\Controllers\Api\V1\Hr\PerformanceTrackerController::class, 'store']);
            Route::get('performance/{performanceTracker}', [\App\Http\Controllers\Api\V1\Hr\PerformanceTrackerController::class, 'show']);
            Route::put('performance/{performanceTracker}', [\App\Http\Controllers\Api\V1\Hr\PerformanceTrackerController::class, 'update']);
            Route::delete('performance/{performanceTracker}', [\App\Http\Controllers\Api\V1\Hr\PerformanceTrackerController::class, 'destroy']);

            // HR Documents (aggregated list across all HR personal files — HR admin sees all, staff sees own)
            Route::get('documents', [\App\Http\Controllers\Api\V1\Hr\HrDocumentsController::class, 'index']);
            // HR Personal Files
            Route::get('files', [\App\Http\Controllers\Api\V1\Hr\HrPersonalFileController::class, 'index']);
            Route::post('files', [\App\Http\Controllers\Api\V1\Hr\HrPersonalFileController::class, 'store']);
            Route::get('files/{hrPersonalFile}', [\App\Http\Controllers\Api\V1\Hr\HrPersonalFileController::class, 'show']);
            Route::put('files/{hrPersonalFile}', [\App\Http\Controllers\Api\V1\Hr\HrPersonalFileController::class, 'update']);
            Route::get('files/{hrPersonalFile}/timeline', [\App\Http\Controllers\Api\V1\Hr\HrPersonalFileController::class, 'timeline']);
            Route::post('files/{hrPersonalFile}/timeline', [\App\Http\Controllers\Api\V1\Hr\HrPersonalFileController::class, 'addTimelineEvent']);
            Route::get('files/{hrPersonalFile}/documents', [\App\Http\Controllers\Api\V1\Hr\HrPersonalFileController::class, 'documents']);
            Route::post('files/{hrPersonalFile}/documents', [\App\Http\Controllers\Api\V1\Hr\HrPersonalFileController::class, 'uploadDocument']);
            Route::delete('files/{hrPersonalFile}/documents/{document}', [\App\Http\Controllers\Api\V1\Hr\HrPersonalFileController::class, 'deleteDocument']);

            // Performance Appraisal
            Route::get('appraisal-cycles', [\App\Http\Controllers\Api\V1\Hr\AppraisalController::class, 'cycles']);
            Route::get('appraisals', [\App\Http\Controllers\Api\V1\Hr\AppraisalController::class, 'index']);
            Route::get('appraisals/{appraisal}', [\App\Http\Controllers\Api\V1\Hr\AppraisalController::class, 'show']);
            Route::post('appraisals', [\App\Http\Controllers\Api\V1\Hr\AppraisalController::class, 'store']);
            Route::put('appraisals/{appraisal}', [\App\Http\Controllers\Api\V1\Hr\AppraisalController::class, 'update']);
            Route::delete('appraisals/{appraisal}', [\App\Http\Controllers\Api\V1\Hr\AppraisalController::class, 'destroy']);
            Route::post('appraisals/{appraisal}/submit-self-assessment', [\App\Http\Controllers\Api\V1\Hr\AppraisalController::class, 'submitSelfAssessment']);
            Route::post('appraisals/{appraisal}/supervisor-review', [\App\Http\Controllers\Api\V1\Hr\AppraisalController::class, 'supervisorReview']);
            Route::post('appraisals/{appraisal}/hod-review', [\App\Http\Controllers\Api\V1\Hr\AppraisalController::class, 'hodReview']);
            Route::post('appraisals/{appraisal}/finalize', [\App\Http\Controllers\Api\V1\Hr\AppraisalController::class, 'finalize']);
            Route::post('appraisals/{appraisal}/acknowledge', [\App\Http\Controllers\Api\V1\Hr\AppraisalController::class, 'acknowledge']);
            Route::get('appraisals/{appraisal}/attachments', [\App\Http\Controllers\Api\V1\Hr\AppraisalAttachmentController::class, 'index']);
            Route::post('appraisals/{appraisal}/attachments', [\App\Http\Controllers\Api\V1\Hr\AppraisalAttachmentController::class, 'store']);
            Route::delete('appraisals/{appraisal}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Hr\AppraisalAttachmentController::class, 'destroy']);
            Route::get('appraisals/{appraisal}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Hr\AppraisalAttachmentController::class, 'download']);

            // Conduct, Discipline & Recognition
            Route::get('conduct', [\App\Http\Controllers\Api\V1\Hr\ConductRecordController::class, 'index']);
            Route::get('conduct/{conductRecord}', [\App\Http\Controllers\Api\V1\Hr\ConductRecordController::class, 'show']);
            Route::post('conduct', [\App\Http\Controllers\Api\V1\Hr\ConductRecordController::class, 'store']);
            Route::put('conduct/{conductRecord}', [\App\Http\Controllers\Api\V1\Hr\ConductRecordController::class, 'update']);
            Route::delete('conduct/{conductRecord}', [\App\Http\Controllers\Api\V1\Hr\ConductRecordController::class, 'destroy']);
        });

        require __DIR__.'/api/contracts.php';

        require __DIR__.'/api/programmes.php';

        require __DIR__.'/api/mande.php';

        // Workplan
        Route::prefix('workplan')->group(function () {
            Route::get('meeting-types', [\App\Http\Controllers\Api\V1\Workplan\MeetingTypeController::class, 'index']);
            Route::post('meeting-types', [\App\Http\Controllers\Api\V1\Workplan\MeetingTypeController::class, 'store']);
            Route::put('meeting-types/{meetingType}', [\App\Http\Controllers\Api\V1\Workplan\MeetingTypeController::class, 'update']);
            Route::delete('meeting-types/{meetingType}', [\App\Http\Controllers\Api\V1\Workplan\MeetingTypeController::class, 'destroy']);
            Route::get('event-types', [\App\Http\Controllers\Api\V1\Workplan\WorkplanEventTypeController::class, 'index']);
            Route::post('event-types', [\App\Http\Controllers\Api\V1\Workplan\WorkplanEventTypeController::class, 'store']);
            Route::put('event-types/{eventType}', [\App\Http\Controllers\Api\V1\Workplan\WorkplanEventTypeController::class, 'update']);
            Route::delete('event-types/{eventType}', [\App\Http\Controllers\Api\V1\Workplan\WorkplanEventTypeController::class, 'destroy']);
            Route::get('events/import/template', [\App\Http\Controllers\Api\V1\Workplan\WorkplanController::class, 'importTemplate']);
            Route::post('events/import', [\App\Http\Controllers\Api\V1\Workplan\WorkplanController::class, 'import']);
            Route::post('events/bulk-delete', [\App\Http\Controllers\Api\V1\Workplan\WorkplanController::class, 'bulkDestroy']);
            Route::get('events/{event}/attachments', [\App\Http\Controllers\Api\V1\Workplan\WorkplanAttachmentController::class, 'index']);
            Route::post('events/{event}/attachments', [\App\Http\Controllers\Api\V1\Workplan\WorkplanAttachmentController::class, 'store']);
            Route::delete('events/{event}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Workplan\WorkplanAttachmentController::class, 'destroy']);
            Route::get('events/{event}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Workplan\WorkplanAttachmentController::class, 'download']);
            Route::apiResource('events', \App\Http\Controllers\Api\V1\Workplan\WorkplanController::class)->parameters(['events' => 'event']);
        });

        // SADC PF Calendar, Public Holidays, UN Days
        Route::prefix('calendar')->group(function () {
            Route::get('entries', [\App\Http\Controllers\Api\V1\Calendar\CalendarController::class, 'index']);
            Route::get('entries/{calendarEntry}', [\App\Http\Controllers\Api\V1\Calendar\CalendarController::class, 'show']);
            Route::post('entries', [\App\Http\Controllers\Api\V1\Calendar\CalendarController::class, 'store']);
            Route::post('entries/upload', [\App\Http\Controllers\Api\V1\Calendar\CalendarController::class, 'upload']);
            Route::put('entries/{calendarEntry}', [\App\Http\Controllers\Api\V1\Calendar\CalendarController::class, 'update']);
            Route::delete('entries/{calendarEntry}', [\App\Http\Controllers\Api\V1\Calendar\CalendarController::class, 'destroy']);
        });

        // Analytics
        Route::get('analytics/summary', [\App\Http\Controllers\Api\V1\AnalyticsController::class, 'summary']);
        Route::get('analytics/module/{module}', [\App\Http\Controllers\Api\V1\AnalyticsController::class, 'byModule']);

        // Reports — gated on reports.view permission
        Route::middleware('permission:reports.view|reports.view.authorised')->group(function () {
            Route::get('reports/summary', [\App\Http\Controllers\Api\V1\ReportsController::class, 'summary']);
            Route::get('reports/users', [\App\Http\Controllers\Api\V1\ReportsController::class, 'reportUsers']);
            Route::get('reports/departments', [\App\Http\Controllers\Api\V1\ReportsController::class, 'reportDepartments']);
            Route::get('reports/travel', [\App\Http\Controllers\Api\V1\ReportsController::class, 'travel']);
            Route::get('reports/leave', [\App\Http\Controllers\Api\V1\ReportsController::class, 'leave']);
            Route::get('reports/dsa', [\App\Http\Controllers\Api\V1\ReportsController::class, 'dsa']);
            Route::get('reports/assets', [\App\Http\Controllers\Api\V1\ReportsController::class, 'assets']);
            Route::get('reports/stock', [\App\Http\Controllers\Api\V1\ReportsController::class, 'stock']);
            Route::get('reports/imprest', [\App\Http\Controllers\Api\V1\ReportsController::class, 'imprest']);
            Route::get('reports/procurement', [\App\Http\Controllers\Api\V1\ReportsController::class, 'procurement']);
            Route::get('reports/salary-advances', [\App\Http\Controllers\Api\V1\ReportsController::class, 'salaryAdvances']);
            Route::get('reports/hr-timesheets', [\App\Http\Controllers\Api\V1\ReportsController::class, 'hrTimesheets']);
            Route::get('reports/risk', [\App\Http\Controllers\Api\V1\ReportsController::class, 'risk']);
            Route::get('reports/governance', [\App\Http\Controllers\Api\V1\ReportsController::class, 'governance']);
            Route::get('reports/schedules', [\App\Http\Controllers\Api\V1\ReportsManagementController::class, 'schedules']);
            Route::get('reports/export-events', [\App\Http\Controllers\Api\V1\ReportsManagementController::class, 'exportEvents']);
            Route::get('reports/export-events/{id}/download', [\App\Http\Controllers\Api\V1\ReportsManagementController::class, 'downloadExport']);
            Route::post('reports/schedules', [\App\Http\Controllers\Api\V1\ReportsManagementController::class, 'createSchedule'])->middleware('can:reports.schedule');
            Route::post('reports/schedules/{id}/approve', [\App\Http\Controllers\Api\V1\ReportsManagementController::class, 'approveSchedule'])->middleware('can:reports.manage-schedules');
            Route::post('reports/schedules/{id}/pause', [\App\Http\Controllers\Api\V1\ReportsManagementController::class, 'pauseSchedule'])->middleware('can:reports.manage-schedules');
        });

        // Asset categories (CRUD; same auth as asset create)
        Route::get('asset-categories', [\App\Http\Controllers\Api\V1\Assets\AssetCategoryController::class, 'index']);
        Route::post('asset-categories', [\App\Http\Controllers\Api\V1\Assets\AssetCategoryController::class, 'store']);
        Route::put('asset-categories/{assetCategory}', [\App\Http\Controllers\Api\V1\Assets\AssetCategoryController::class, 'update']);
        Route::delete('asset-categories/{assetCategory}', [\App\Http\Controllers\Api\V1\Assets\AssetCategoryController::class, 'destroy']);

        // Assets (inventory, fleet - filter by category or assigned_to=me; create gated by admin/manager)
        Route::get('assets/dashboard', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'dashboard']);
        Route::get('assets/assigned-to-me', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'assignedToMe']);
        Route::get('assets/register-export', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'registerExport']);
        Route::post('assets/register/clear', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'clearRegister']);
        Route::post('assets/qr-batch', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'qrBatch']);
        Route::get('assets/qr/{token}', [\App\Http\Controllers\Api\V1\Assets\PublicAssetQrController::class, 'authenticated'])
            ->where('token', '[A-Za-z0-9_-]+');
        Route::get('assets/rooms/{token}', [\App\Http\Controllers\Api\V1\Assets\AssetPhase2Controller::class, 'showRoom'])
            ->where('token', '[A-Za-z0-9_-]+');
        Route::post('assets/scan-baskets', [\App\Http\Controllers\Api\V1\Assets\AssetPhase2Controller::class, 'storeBasket']);
        Route::get('assets/scan-baskets/{scanBasket}', [\App\Http\Controllers\Api\V1\Assets\AssetPhase2Controller::class, 'showBasket']);
        Route::post('assets/scan-baskets/{scanBasket}/items', [\App\Http\Controllers\Api\V1\Assets\AssetPhase2Controller::class, 'addBasketItem']);
        Route::post('assets/scan-baskets/{scanBasket}/start-handover', [\App\Http\Controllers\Api\V1\Assets\AssetPhase2Controller::class, 'startBasketHandover']);

        Route::get('asset-kits', [\App\Http\Controllers\Api\V1\Assets\AssetPhase2Controller::class, 'indexKits']);
        Route::post('asset-kits', [\App\Http\Controllers\Api\V1\Assets\AssetPhase2Controller::class, 'storeKit']);
        Route::post('asset-locations/{assetLocation}/room-token', [\App\Http\Controllers\Api\V1\Assets\AssetPhase2Controller::class, 'issueRoomToken']);
        Route::get('asset-equipment-templates', [\App\Http\Controllers\Api\V1\Assets\AssetPhase2Controller::class, 'indexTemplates']);
        Route::post('asset-equipment-templates', [\App\Http\Controllers\Api\V1\Assets\AssetPhase2Controller::class, 'storeTemplate']);
        Route::get('asset-equipment-templates/gaps', [\App\Http\Controllers\Api\V1\Assets\AssetPhase2Controller::class, 'templateGaps']);
        Route::get('asset-attestations', [\App\Http\Controllers\Api\V1\Assets\AssetPhase2Controller::class, 'indexAttestations']);
        Route::post('asset-attestations', [\App\Http\Controllers\Api\V1\Assets\AssetPhase2Controller::class, 'storeAttestation']);
        Route::post('asset-attestations/{assetAttestationCampaign}/attest', [\App\Http\Controllers\Api\V1\Assets\AssetPhase2Controller::class, 'attest']);
        Route::post('asset-planner/slots', [\App\Http\Controllers\Api\V1\Assets\AssetPhase2Controller::class, 'storePlannerSlot']);

        Route::get('asset-settings/recovery-contact', [\App\Http\Controllers\Api\V1\Assets\AssetSettingsController::class, 'showRecoveryContact']);
        Route::put('asset-settings/recovery-contact', [\App\Http\Controllers\Api\V1\Assets\AssetSettingsController::class, 'updateRecoveryContact']);
        Route::get('asset-settings/recovery-contact/history', [\App\Http\Controllers\Api\V1\Assets\AssetSettingsController::class, 'recoveryContactHistory']);
        Route::get('asset-settings/numbering', [\App\Http\Controllers\Api\V1\Assets\AssetSettingsController::class, 'numbering']);
        Route::put('asset-settings/numbering', [\App\Http\Controllers\Api\V1\Assets\AssetSettingsController::class, 'updateNumbering']);

        Route::get('asset-batches', [\App\Http\Controllers\Api\V1\Assets\AssetBatchController::class, 'index']);
        Route::post('asset-batches', [\App\Http\Controllers\Api\V1\Assets\AssetBatchController::class, 'store']);
        Route::get('asset-batches/{assetAcquisitionBatch}', [\App\Http\Controllers\Api\V1\Assets\AssetBatchController::class, 'show']);
        Route::post('asset-batches/{assetAcquisitionBatch}/create-assets', [\App\Http\Controllers\Api\V1\Assets\AssetBatchController::class, 'createAssets']);
        Route::post('asset-batches/{assetAcquisitionBatch}/print-labels', [\App\Http\Controllers\Api\V1\Assets\AssetBatchController::class, 'printLabels']);
        Route::post('asset-batches/{assetAcquisitionBatch}/attach-grn', [\App\Http\Controllers\Api\V1\Assets\AssetBatchController::class, 'attachGrn']);

        Route::get('assets/handovers/register', [\App\Http\Controllers\Api\V1\Assets\AssetHandoverController::class, 'register']);
        Route::get('asset-handovers', [\App\Http\Controllers\Api\V1\Assets\AssetHandoverController::class, 'index']);
        Route::post('asset-handovers', [\App\Http\Controllers\Api\V1\Assets\AssetHandoverController::class, 'store']);
        Route::get('asset-handovers/{assetHandover}', [\App\Http\Controllers\Api\V1\Assets\AssetHandoverController::class, 'show']);
        Route::post('asset-handovers/{assetHandover}/lines', [\App\Http\Controllers\Api\V1\Assets\AssetHandoverController::class, 'addLines']);
        Route::post('asset-handovers/{assetHandover}/send', [\App\Http\Controllers\Api\V1\Assets\AssetHandoverController::class, 'send']);
        Route::post('asset-handovers/{assetHandover}/cancel', [\App\Http\Controllers\Api\V1\Assets\AssetHandoverController::class, 'cancel']);
        Route::post('asset-handovers/{assetHandover}/sign', [\App\Http\Controllers\Api\V1\Assets\AssetHandoverController::class, 'sign']);
        Route::post('asset-handovers/{assetHandover}/paper-sign', [\App\Http\Controllers\Api\V1\Assets\AssetHandoverController::class, 'paperSign']);
        Route::get('asset-handovers/{assetHandover}/certificate', [\App\Http\Controllers\Api\V1\Assets\AssetHandoverController::class, 'certificate']);
        Route::post('asset-handovers/{assetHandover}/lines/{assetHandoverLine}/respond', [\App\Http\Controllers\Api\V1\Assets\AssetHandoverController::class, 'respond']);

        Route::get('assets/checkouts', [\App\Http\Controllers\Api\V1\Assets\AssetOperationsController::class, 'checkoutsIndex']);
        Route::get('assets/transfers', [\App\Http\Controllers\Api\V1\Assets\AssetOperationsController::class, 'transfersIndex']);
        Route::get('assets/incidents', [\App\Http\Controllers\Api\V1\Assets\AssetOperationsController::class, 'incidentsIndex']);
        Route::get('assets/reports/{type}', [\App\Http\Controllers\Api\V1\Assets\AssetOperationsController::class, 'reports']);
        Route::post('asset-categories/{assetCategory}/subcategories', [\App\Http\Controllers\Api\V1\Assets\AssetOperationsController::class, 'storeSubcategory']);
        Route::get('asset-categories/{assetCategory}/subcategories', [\App\Http\Controllers\Api\V1\Assets\AssetOperationsController::class, 'listSubcategories']);
        Route::put('assets-meta/locations/{assetLocation}', [\App\Http\Controllers\Api\V1\Assets\AssetOperationsController::class, 'updateLocation']);
        Route::post('asset-transfers/{assetTransfer}/confirm-outgoing', [\App\Http\Controllers\Api\V1\Assets\AssetOperationsController::class, 'confirmOutgoing']);
        Route::post('asset-transfers/{assetTransfer}/accept', [\App\Http\Controllers\Api\V1\Assets\AssetOperationsController::class, 'acceptTransfer']);

        Route::get('assets/import/template', [\App\Http\Controllers\Api\V1\Assets\AssetImportController::class, 'downloadTemplate']);
        Route::get('assets/import', [\App\Http\Controllers\Api\V1\Assets\AssetImportController::class, 'index']);
        Route::post('assets/import', [\App\Http\Controllers\Api\V1\Assets\AssetImportController::class, 'store']);
        Route::get('assets/import/{assetImportBatch}', [\App\Http\Controllers\Api\V1\Assets\AssetImportController::class, 'show']);
        Route::get('assets/import/{assetImportBatch}/staging', [\App\Http\Controllers\Api\V1\Assets\AssetImportController::class, 'staging']);
        Route::patch('assets/import/{assetImportBatch}/staging/{staging}', [\App\Http\Controllers\Api\V1\Assets\AssetImportController::class, 'updateStaging']);
        Route::post('assets/import/{assetImportBatch}/approve', [\App\Http\Controllers\Api\V1\Assets\AssetImportController::class, 'approve']);
        Route::post('assets/import/{assetImportBatch}/staging/{staging}/exclude', [\App\Http\Controllers\Api\V1\Assets\AssetImportController::class, 'exclude']);
        Route::post('assets/import/{assetImportBatch}/staging/{staging}/merge-duplicates', [\App\Http\Controllers\Api\V1\Assets\AssetImportController::class, 'mergeDuplicates']);
        Route::post('assets/import/{assetImportBatch}/staging/{staging}/mark-unavailable', [\App\Http\Controllers\Api\V1\Assets\AssetImportController::class, 'markUnavailable']);
        Route::post('assets/import/{assetImportBatch}/discrepancies/{discrepancy}/resolve', [\App\Http\Controllers\Api\V1\Assets\AssetImportController::class, 'resolveDiscrepancy']);
        Route::get('assets/import/{assetImportBatch}/raw/{raw}', [\App\Http\Controllers\Api\V1\Assets\AssetImportController::class, 'raw']);
        Route::post('assets/import/{assetImportBatch}/map-location', [\App\Http\Controllers\Api\V1\Assets\AssetImportController::class, 'mapLocation']);
        Route::post('assets/import/{assetImportBatch}/map-custodian', [\App\Http\Controllers\Api\V1\Assets\AssetImportController::class, 'mapCustodian']);
        Route::post('assets/import/{assetImportBatch}/commit', [\App\Http\Controllers\Api\V1\Assets\AssetImportController::class, 'commit']);
        Route::get('assets/import/{assetImportBatch}/report', [\App\Http\Controllers\Api\V1\Assets\AssetImportController::class, 'report']);

        Route::get('assets/labels/templates', [\App\Http\Controllers\Api\V1\Assets\AssetLabelController::class, 'templates']);
        Route::post('assets/labels/templates', [\App\Http\Controllers\Api\V1\Assets\AssetLabelController::class, 'storeTemplate']);
        Route::put('assets/labels/templates/{assetLabelTemplate}', [\App\Http\Controllers\Api\V1\Assets\AssetLabelController::class, 'updateTemplate']);
        Route::delete('assets/labels/templates/{assetLabelTemplate}', [\App\Http\Controllers\Api\V1\Assets\AssetLabelController::class, 'destroyTemplate']);
        Route::get('assets/labels/reprint-queue', [\App\Http\Controllers\Api\V1\Assets\AssetLabelController::class, 'reprintQueue']);
        Route::get('assets/labels/batches', [\App\Http\Controllers\Api\V1\Assets\AssetLabelController::class, 'batches']);
        Route::post('assets/labels/print', [\App\Http\Controllers\Api\V1\Assets\AssetLabelController::class, 'print']);

        Route::get('assets/unregistered-finds', [\App\Http\Controllers\Api\V1\Assets\AssetUnregisteredFindController::class, 'index']);
        Route::post('assets/unregistered-finds', [\App\Http\Controllers\Api\V1\Assets\AssetUnregisteredFindController::class, 'store']);
        Route::post('assets/unregistered-finds/{find}/promote', [\App\Http\Controllers\Api\V1\Assets\AssetUnregisteredFindController::class, 'promote']);

        Route::get('assets', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'index']);
        Route::post('assets', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'store']);
        Route::post('assets/{asset}/capitalise', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'capitalise']);
        Route::post('assets/{asset}/reject-capitalisation', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'rejectCapitalisation']);
        Route::post('assets/{asset}/assign', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'assign']);
        Route::post('assets/{asset}/acknowledge', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'acknowledge']);
        Route::post('assets/{asset}/decline', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'decline']);
        Route::post('assets/{asset}/request-return', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'requestReturn']);
        Route::post('assets/{asset}/transfer', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'transfer']);
        Route::post('assets/{asset}/return', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'returnAsset']);
        Route::post('assets/{asset}/mark-condition', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'markCondition']);
        Route::post('assets/{asset}/parent', [\App\Http\Controllers\Api\V1\Assets\AssetPhase2Controller::class, 'setParent']);
        Route::post('assets/{asset}/move', [\App\Http\Controllers\Api\V1\Assets\AssetOperationsController::class, 'move']);
        Route::post('assets/{asset}/checkout', [\App\Http\Controllers\Api\V1\Assets\AssetOperationsController::class, 'checkout']);
        Route::post('assets/{asset}/return-checkout', [\App\Http\Controllers\Api\V1\Assets\AssetOperationsController::class, 'returnCheckout']);
        Route::post('assets/{asset}/transfers', [\App\Http\Controllers\Api\V1\Assets\AssetOperationsController::class, 'initiateTransfer']);
        Route::post('assets/{asset}/report-lost', [\App\Http\Controllers\Api\V1\Assets\AssetOperationsController::class, 'reportLost']);
        Route::post('assets/{asset}/report-stolen', [\App\Http\Controllers\Api\V1\Assets\AssetOperationsController::class, 'reportStolen']);
        Route::post('assets/{asset}/report-found', [\App\Http\Controllers\Api\V1\Assets\AssetOperationsController::class, 'reportFound']);
        Route::get('assets/{asset}/timeline', [\App\Http\Controllers\Api\V1\Assets\AssetOperationsController::class, 'timeline']);
        Route::get('assets/{asset}/documents', [\App\Http\Controllers\Api\V1\Assets\AssetOperationsController::class, 'documents']);
        Route::post('assets/{asset}/documents', [\App\Http\Controllers\Api\V1\Assets\AssetOperationsController::class, 'storeDocument']);
        Route::get('assets/{asset}/documents/{attachment}', [\App\Http\Controllers\Api\V1\Assets\AssetOperationsController::class, 'downloadDocument']);
        Route::delete('assets/{asset}/documents/{attachment}', [\App\Http\Controllers\Api\V1\Assets\AssetOperationsController::class, 'destroyDocument']);
        Route::get('assets/{asset}/assignment-history', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'assignmentHistory']);
        Route::get('assets/{asset}/custody-history', [\App\Http\Controllers\Api\V1\Assets\AssetHandoverController::class, 'custodyHistory']);
        Route::get('assets/{asset}', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'show']);
        Route::put('assets/{asset}', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'update']);
        Route::delete('assets/{asset}', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'destroy']);
        Route::get('assets/{asset}/qr', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'qr']);
        Route::post('assets/{asset}/invoice', [\App\Http\Controllers\Api\V1\Assets\AssetController::class, 'uploadInvoice']);

        require __DIR__.'/api/fleet.php';

        // Asset lifecycle: locations, policies, verification, maintenance, depreciation
        Route::get('assets-meta/locations', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'locations']);
        Route::post('assets-meta/locations', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'storeLocation']);
        Route::get('assets-meta/capitalisation-policies', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'policies']);
        Route::post('assets-meta/capitalisation-policies', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'storePolicy']);
        Route::get('assets-meta/verification-campaigns', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'campaigns']);
        Route::post('assets-meta/verification-campaigns', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'storeCampaign']);
        Route::get('assets-meta/verification-campaigns/{assetVerificationCampaign}/dashboard', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'campaignDashboard']);
        Route::post('assets-meta/verification-campaigns/{assetVerificationCampaign}/results', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'recordVerification']);
        Route::post('assets-meta/verification-campaigns/{assetVerificationCampaign}/close', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'closeCampaign']);
        Route::get('assets-meta/maintenance', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'maintenanceIndex']);
        Route::post('assets-meta/maintenance', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'storeMaintenance']);
        Route::post('assets-meta/maintenance/{assetMaintenanceRecord}/complete', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'completeMaintenance']);
        Route::get('assets-meta/depreciation-runs', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'depreciationRuns']);
        Route::get('assets-meta/depreciation-runs/{assetDepreciationRun}', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'showDepreciationRun']);
        Route::post('assets-meta/depreciation-runs', [\App\Http\Controllers\Api\V1\Assets\AssetLifecycleController::class, 'runDepreciation']);
        Route::get('assets-meta/insurance/policies', [\App\Http\Controllers\Api\V1\Assets\AssetInsuranceController::class, 'indexPolicies']);
        Route::post('assets-meta/insurance/policies', [\App\Http\Controllers\Api\V1\Assets\AssetInsuranceController::class, 'storePolicy']);
        Route::put('assets-meta/insurance/policies/{policy}', [\App\Http\Controllers\Api\V1\Assets\AssetInsuranceController::class, 'updatePolicy']);
        Route::post('assets-meta/insurance/policies/{policy}/renew', [\App\Http\Controllers\Api\V1\Assets\AssetInsuranceController::class, 'renewPolicy']);
        Route::get('assets-meta/insurance/claims', [\App\Http\Controllers\Api\V1\Assets\AssetInsuranceController::class, 'indexClaims']);
        Route::post('assets-meta/insurance/claims', [\App\Http\Controllers\Api\V1\Assets\AssetInsuranceController::class, 'storeClaim']);
        Route::put('assets-meta/insurance/claims/{claim}', [\App\Http\Controllers\Api\V1\Assets\AssetInsuranceController::class, 'updateClaim']);

        // Disposal workflow
        Route::get('asset-disposals', [\App\Http\Controllers\Api\V1\Assets\AssetDisposalController::class, 'index']);
        Route::post('asset-disposals', [\App\Http\Controllers\Api\V1\Assets\AssetDisposalController::class, 'store']);
        Route::get('asset-disposals/{assetDisposal}', [\App\Http\Controllers\Api\V1\Assets\AssetDisposalController::class, 'show']);
        Route::post('asset-disposals/{assetDisposal}/recommend', [\App\Http\Controllers\Api\V1\Assets\AssetDisposalController::class, 'recommend']);
        Route::post('asset-disposals/{assetDisposal}/finance-review', [\App\Http\Controllers\Api\V1\Assets\AssetDisposalController::class, 'financeReview']);
        Route::post('asset-disposals/{assetDisposal}/approve', [\App\Http\Controllers\Api\V1\Assets\AssetDisposalController::class, 'approve']);
        Route::post('asset-disposals/{assetDisposal}/complete', [\App\Http\Controllers\Api\V1\Assets\AssetDisposalController::class, 'complete']);

        // Revaluation workflow
        Route::get('asset-revaluations', [\App\Http\Controllers\Api\V1\Assets\AssetRevaluationController::class, 'index']);
        Route::post('asset-revaluations', [\App\Http\Controllers\Api\V1\Assets\AssetRevaluationController::class, 'store']);
        Route::get('asset-revaluations/{assetRevaluation}', [\App\Http\Controllers\Api\V1\Assets\AssetRevaluationController::class, 'show']);
        Route::post('asset-revaluations/{assetRevaluation}/approve', [\App\Http\Controllers\Api\V1\Assets\AssetRevaluationController::class, 'approve']);
        Route::post('asset-revaluations/{assetRevaluation}/reject', [\App\Http\Controllers\Api\V1\Assets\AssetRevaluationController::class, 'reject']);

        // Asset Movements
        Route::get('assets/movements/list', [\App\Http\Controllers\Api\V1\Assets\AssetMovementController::class, 'index']);
        Route::post('assets/movements', [\App\Http\Controllers\Api\V1\Assets\AssetMovementController::class, 'store']);
        Route::get('assets/movements/{assetMovement}', [\App\Http\Controllers\Api\V1\Assets\AssetMovementController::class, 'show']);

        // Asset requests (any auth user can request; managers see all)
        Route::get('asset-requests', [\App\Http\Controllers\Api\V1\Assets\AssetRequestController::class, 'index']);
        Route::post('asset-requests', [\App\Http\Controllers\Api\V1\Assets\AssetRequestController::class, 'store']);
        Route::get('asset-requests/{assetRequest}', [\App\Http\Controllers\Api\V1\Assets\AssetRequestController::class, 'show']);
        Route::put('asset-requests/{assetRequest}', [\App\Http\Controllers\Api\V1\Assets\AssetRequestController::class, 'update']);
        Route::delete('asset-requests/{assetRequest}', [\App\Http\Controllers\Api\V1\Assets\AssetRequestController::class, 'destroy']);

        Route::get('inventory/unified-register', [\App\Http\Controllers\Api\V1\Inventory\UnifiedInventoryController::class, 'index']);

        // ── Consumables / Stock Register (PRD §17, §27) ───────────────────────
        // SEPARATE from the Fixed Asset Register above. Read routes gated on
        // stock.view; write actions are gated by Form Request authorize() using
        // stock.create / stock.edit / stock.issue / stock.manage / stock.admin.
        Route::middleware('can:stock.view')->group(function () {
            Route::get('stock/dashboard', \App\Http\Controllers\Api\V1\Stock\StockDashboardController::class);

            // Stock categories (admin config — §27)
            Route::get('stock/categories', [\App\Http\Controllers\Api\V1\Stock\StockCategoryController::class, 'index']);
            Route::post('stock/categories', [\App\Http\Controllers\Api\V1\Stock\StockCategoryController::class, 'store']);
            Route::put('stock/categories/{stockCategory}', [\App\Http\Controllers\Api\V1\Stock\StockCategoryController::class, 'update']);
            Route::delete('stock/categories/{stockCategory}', [\App\Http\Controllers\Api\V1\Stock\StockCategoryController::class, 'destroy']);

            // Units of measure & store locations
            Route::get('stock/units', [\App\Http\Controllers\Api\V1\Stock\StockUnitController::class, 'index']);
            Route::post('stock/units', [\App\Http\Controllers\Api\V1\Stock\StockUnitController::class, 'store']);
            Route::put('stock/units/{stockUnit}', [\App\Http\Controllers\Api\V1\Stock\StockUnitController::class, 'update']);
            Route::delete('stock/units/{stockUnit}', [\App\Http\Controllers\Api\V1\Stock\StockUnitController::class, 'destroy']);

            Route::get('stock/locations', [\App\Http\Controllers\Api\V1\Stock\StockLocationController::class, 'index']);
            Route::post('stock/locations', [\App\Http\Controllers\Api\V1\Stock\StockLocationController::class, 'store']);
            Route::put('stock/locations/{stockLocation}', [\App\Http\Controllers\Api\V1\Stock\StockLocationController::class, 'update']);
            Route::delete('stock/locations/{stockLocation}', [\App\Http\Controllers\Api\V1\Stock\StockLocationController::class, 'destroy']);

            // Stocktakes / physical counts
            Route::get('stock/stocktakes', [\App\Http\Controllers\Api\V1\Stock\StocktakeController::class, 'index']);
            Route::post('stock/stocktakes', [\App\Http\Controllers\Api\V1\Stock\StocktakeController::class, 'store']);
            Route::get('stock/stocktakes/{stocktake}', [\App\Http\Controllers\Api\V1\Stock\StocktakeController::class, 'show']);
            Route::put('stock/stocktakes/{stocktake}/counts', [\App\Http\Controllers\Api\V1\Stock\StocktakeController::class, 'updateCounts']);
            Route::post('stock/stocktakes/{stocktake}/sync-offline', [\App\Http\Controllers\Api\V1\Stock\StocktakeController::class, 'syncOffline']);
            Route::post('stock/stocktakes/{stocktake}/complete', [\App\Http\Controllers\Api\V1\Stock\StocktakeController::class, 'complete']);
            Route::post('stock/stocktakes/{stocktake}/approve-variances', [\App\Http\Controllers\Api\V1\Stock\StocktakeController::class, 'approveVariances']);
            Route::post('stock/stocktakes/{stocktake}/cancel', [\App\Http\Controllers\Api\V1\Stock\StocktakeController::class, 'cancel']);

            // Stock movements (in/out/adjustment) — declared before {stockItem} to avoid clashes
            Route::get('stock/transactions', [\App\Http\Controllers\Api\V1\Stock\StockTransactionController::class, 'index']);
            Route::post('stock/transactions', [\App\Http\Controllers\Api\V1\Stock\StockTransactionController::class, 'store']);
            Route::get('stock/transactions/{stockTransaction}', [\App\Http\Controllers\Api\V1\Stock\StockTransactionController::class, 'show']);

            // PRD Phase 1 stores workflows
            $stores = \App\Http\Controllers\Api\V1\Stock\StockStoresController::class;
            Route::match(['get', 'post'], 'stock/availability', [$stores, 'availability']);

            Route::get('stock/requests', [$stores, 'indexRequests']);
            Route::post('stock/requests', [$stores, 'storeRequest']);
            Route::get('stock/requests/{stockRequest}', [$stores, 'showRequest']);
            Route::post('stock/requests/{stockRequest}/submit', [$stores, 'submitRequest']);
            Route::post('stock/requests/{stockRequest}/approve', [$stores, 'approveRequest']);
            Route::post('stock/requests/{stockRequest}/reject', [$stores, 'rejectRequest']);
            Route::post('stock/requests/{stockRequest}/cancel', [$stores, 'cancelRequest']);

            Route::get('stock/issues', [$stores, 'indexIssues']);
            Route::post('stock/issues', [$stores, 'storeIssue']);
            Route::get('stock/issues/{stockIssue}', [$stores, 'showIssue']);
            Route::post('stock/issues/{stockIssue}/acknowledge', [$stores, 'acknowledgeIssue']);

            Route::get('stock/returns', [$stores, 'indexReturns']);
            Route::post('stock/returns', [$stores, 'storeReturn']);

            Route::get('stock/transfers', [$stores, 'indexTransfers']);
            Route::post('stock/transfers', [$stores, 'storeTransfer']);
            Route::get('stock/transfers/{stockTransfer}', [$stores, 'showTransfer']);
            Route::post('stock/transfers/{stockTransfer}/dispatch', [$stores, 'dispatchTransfer']);
            Route::post('stock/transfers/{stockTransfer}/receive', [$stores, 'receiveTransfer']);

            Route::get('stock/write-offs', [$stores, 'indexWriteOffs']);
            Route::post('stock/write-offs', [$stores, 'storeWriteOff']);
            Route::post('stock/write-offs/{stockWriteOff}/approve', [$stores, 'approveWriteOff']);

            Route::get('stock/replenishments', [$stores, 'indexReplenishments']);
            Route::post('stock/replenishments', [$stores, 'storeReplenishment']);

            Route::get('stock/batches', [$stores, 'indexBatches']);
            Route::post('stock/batches', [$stores, 'storeBatch']);
            Route::get('stock/demand-forecast', [$stores, 'demandForecast']);
            Route::get('stock/event-packs', [\App\Http\Controllers\Api\V1\Stock\StockEventPackController::class, 'index']);
            Route::post('stock/event-packs', [\App\Http\Controllers\Api\V1\Stock\StockEventPackController::class, 'store']);
            Route::post('stock/event-packs/{eventPack}/instantiate', [\App\Http\Controllers\Api\V1\Stock\StockEventPackController::class, 'instantiate']);
            Route::post('stock/event-packs/{eventPack}/duplicate', [\App\Http\Controllers\Api\V1\Stock\StockEventPackController::class, 'duplicate']);
            Route::post('stock/items/barcode-lookup', [\App\Http\Controllers\Api\V1\Stock\StockEventPackController::class, 'barcodeLookup']);

            // Stock items (§17.2)
            Route::get('stock/items', [\App\Http\Controllers\Api\V1\Stock\StockItemController::class, 'index']);
            Route::post('stock/items', [\App\Http\Controllers\Api\V1\Stock\StockItemController::class, 'store']);
            Route::get('stock/items/by-barcode/{barcode}', [\App\Http\Controllers\Api\V1\Stock\StockItemController::class, 'byBarcode'])
                ->where('barcode', '.*');
            Route::get('stock/items/{stockItem}', [\App\Http\Controllers\Api\V1\Stock\StockItemController::class, 'show']);
            Route::put('stock/items/{stockItem}', [\App\Http\Controllers\Api\V1\Stock\StockItemController::class, 'update']);
            Route::delete('stock/items/{stockItem}', [\App\Http\Controllers\Api\V1\Stock\StockItemController::class, 'destroy']);
            Route::post('stock/items/{stockItem}/quarantine', [$stores, 'quarantine']);
            Route::post('stock/items/{stockItem}/release-quarantine', [$stores, 'releaseQuarantine']);
        });

        require __DIR__.'/api/assignments.php';

        // Governance — committees & meeting-type config
        Route::get('governance/committees', [\App\Http\Controllers\Api\V1\Governance\CommitteeController::class, 'indexCommittees']);
        Route::post('governance/committees', [\App\Http\Controllers\Api\V1\Governance\CommitteeController::class, 'storeCommittee']);
        Route::put('governance/committees/{committee}', [\App\Http\Controllers\Api\V1\Governance\CommitteeController::class, 'updateCommittee']);
        Route::delete('governance/committees/{committee}', [\App\Http\Controllers\Api\V1\Governance\CommitteeController::class, 'destroyCommittee']);
        Route::get('governance/meeting-types', [\App\Http\Controllers\Api\V1\Governance\CommitteeController::class, 'indexMeetingTypes']);
        Route::post('governance/meeting-types', [\App\Http\Controllers\Api\V1\Governance\CommitteeController::class, 'storeMeetingType']);
        Route::put('governance/meeting-types/{meetingType}', [\App\Http\Controllers\Api\V1\Governance\CommitteeController::class, 'updateMeetingType']);
        Route::delete('governance/meeting-types/{meetingType}', [\App\Http\Controllers\Api\V1\Governance\CommitteeController::class, 'destroyMeetingType']);

        // Governance (meetings from workplan, resolutions + multilingual documents)
        Route::get('governance/meetings', [\App\Http\Controllers\Api\V1\Governance\GovernanceController::class, 'meetings']);
        Route::get('governance/resolutions', [\App\Http\Controllers\Api\V1\Governance\GovernanceController::class, 'resolutions']);
        Route::post('governance/resolutions', [\App\Http\Controllers\Api\V1\Governance\GovernanceController::class, 'storeResolution']);
        Route::get('governance/resolutions/{resolution}', [\App\Http\Controllers\Api\V1\Governance\GovernanceController::class, 'showResolution']);
        Route::put('governance/resolutions/{resolution}', [\App\Http\Controllers\Api\V1\Governance\GovernanceController::class, 'updateResolution']);
        Route::delete('governance/resolutions/{resolution}', [\App\Http\Controllers\Api\V1\Governance\GovernanceController::class, 'destroyResolution']);
        Route::post('governance/resolutions/{resolution}/documents', [\App\Http\Controllers\Api\V1\Governance\GovernanceController::class, 'uploadDocument']);
        Route::delete('governance/resolutions/{resolution}/documents/{attachment}', [\App\Http\Controllers\Api\V1\Governance\GovernanceController::class, 'deleteDocument']);
        Route::get('governance/resolutions/{resolution}/documents/{attachment}/download', [\App\Http\Controllers\Api\V1\Governance\GovernanceController::class, 'downloadDocument']);

        // Meeting Minutes (staff meetings, action items, task assignment)
        Route::get('governance/minutes', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'index']);
        Route::post('governance/minutes', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'store']);
        Route::get('governance/minutes/{meetingMinute}', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'show']);
        Route::put('governance/minutes/{meetingMinute}', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'update']);
        Route::delete('governance/minutes/{meetingMinute}', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'destroy']);
        Route::post('governance/minutes/{meetingMinute}/documents', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'uploadDocument']);
        Route::delete('governance/minutes/{meetingMinute}/documents/{attachment}', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'deleteDocument']);
        Route::get('governance/minutes/{meetingMinute}/documents/{attachment}/download', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'downloadDocument']);
        Route::post('governance/minutes/{meetingMinute}/action-items', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'addActionItem']);
        Route::put('governance/minutes/{meetingMinute}/action-items/{actionItem}', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'updateActionItem']);
        Route::delete('governance/minutes/{meetingMinute}/action-items/{actionItem}', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'deleteActionItem']);
        Route::post('governance/minutes/{meetingMinute}/action-items/{actionItem}/assign', [\App\Http\Controllers\Api\V1\Governance\MeetingMinutesController::class, 'assignActionItem']);

        // Meeting Resolutions / Decision Register (Phase 1 + Phase 3)
        Route::prefix('decisions')->group(function () {
            Route::get('dashboard', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'dashboard']);
            Route::get('owners', [\App\Http\Controllers\Api\V1\Decisions\MeetingAgendaController::class, 'ownerOptions']);
            Route::get('minutes-options', [\App\Http\Controllers\Api\V1\Decisions\MeetingAgendaController::class, 'minutesOptions']);
            Route::get('agenda-items', [\App\Http\Controllers\Api\V1\Decisions\MeetingAgendaController::class, 'index']);
            Route::post('agenda-items', [\App\Http\Controllers\Api\V1\Decisions\MeetingAgendaController::class, 'store']);
            Route::post('agenda-items/{agendaItem}/link-decision', [\App\Http\Controllers\Api\V1\Decisions\MeetingAgendaController::class, 'linkDecision']);
            Route::post('promote-weekly-assignments', [\App\Http\Controllers\Api\V1\Decisions\MeetingAgendaController::class, 'promoteWeekly']);
            Route::post('promote-risks', [\App\Http\Controllers\Api\V1\Decisions\MeetingAgendaController::class, 'promoteRisks']);
            Route::post('promote-meeting-pack', [\App\Http\Controllers\Api\V1\Decisions\MeetingAgendaController::class, 'promoteMeetingPack']);
            Route::post('promote-from-minutes', [\App\Http\Controllers\Api\V1\Decisions\MeetingAgendaController::class, 'promoteFromMinutes']);
            Route::get('/', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'index']);
            Route::post('/', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'store']);
            Route::get('{decision}', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'show']);
            Route::put('{decision}', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'update']);
            Route::delete('{decision}', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'destroy']);
            Route::post('{decision}/adopt', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'adopt']);
            Route::post('{decision}/start-progress', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'startProgress']);
            Route::post('{decision}/mark-implemented', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'markImplemented']);
            Route::post('{decision}/close', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'close']);
            Route::post('{decision}/supersede', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'supersede']);
            Route::get('{decision}/history', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'history']);
            Route::post('{decision}/create-assignment', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'createAssignment']);
            Route::get('{decision}/actions', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'listActions']);
            Route::post('{decision}/actions', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'storeAction']);
            Route::put('{decision}/actions/{action}', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'updateAction']);
            Route::post('{decision}/actions/{action}/create-assignment', [\App\Http\Controllers\Api\V1\Decisions\MeetingDecisionController::class, 'createActionAssignment']);
        });

        require __DIR__.'/api/correspondence.php';

        // Support tickets
        Route::get('support/tickets', [\App\Http\Controllers\Api\V1\Support\SupportTicketController::class, 'index']);
        Route::post('support/tickets', [\App\Http\Controllers\Api\V1\Support\SupportTicketController::class, 'store']);
        Route::get('support/tickets/{supportTicket}', [\App\Http\Controllers\Api\V1\Support\SupportTicketController::class, 'show']);
        Route::put('support/tickets/{supportTicket}', [\App\Http\Controllers\Api\V1\Support\SupportTicketController::class, 'update']);
        Route::delete('support/tickets/{supportTicket}', [\App\Http\Controllers\Api\V1\Support\SupportTicketController::class, 'destroy']);

        // Alerts
        Route::get('alerts/summary', [\App\Http\Controllers\Api\V1\Alerts\AlertsController::class, 'summary']);

        // Approval Workflows
        Route::prefix('approvals')->group(function () {
            Route::get('pending', [\App\Http\Controllers\Api\V1\ApprovalController::class, 'pending']);
            Route::get('inbox', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEngineController::class, 'inbox']);
            Route::post('{approvalRequest}/approve', [\App\Http\Controllers\Api\V1\ApprovalController::class, 'approve']);
            Route::post('{approvalRequest}/reject', [\App\Http\Controllers\Api\V1\ApprovalController::class, 'reject']);
            Route::post('{approvalRequest}/recuse', [\App\Http\Controllers\Api\V1\ApprovalController::class, 'recuse']);
            Route::get('{approvalRequest}/history', [\App\Http\Controllers\Api\V1\ApprovalController::class, 'history']);
            Route::get('{approvalRequest}/snapshot', [\App\Http\Controllers\Api\V1\ApprovalController::class, 'snapshot']);
            Route::get('{approvalRequest}/certificate', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEngineController::class, 'certificate']);
        });

        // Workflow Engine Phase 1 (PRD §100)
        Route::prefix('workflow-engine')->group(function () {
            Route::get('definitions', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEngineController::class, 'definitions']);
            Route::patch('definitions/{workflow}/policy', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEngineController::class, 'updatePolicy']);
            Route::post('definitions/{workflow}/versions', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEngineController::class, 'createVersion']);
            Route::post('versions/{version}/validate', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEngineController::class, 'validateVersion']);
            Route::post('versions/{version}/approve', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEngineController::class, 'approveVersion']);
            Route::post('versions/{version}/publish', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEngineController::class, 'publishVersion']);
            Route::post('versions/{version}/retire', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEngineController::class, 'retireVersion']);

            Route::post('workflows/start', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEngineController::class, 'start']);
            Route::get('workflows/{approvalRequest}', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEngineController::class, 'show']);
            Route::get('workflows/{approvalRequest}/timeline', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEngineController::class, 'timeline']);
            Route::post('workflows/{approvalRequest}/withdraw', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEngineController::class, 'withdraw']);
            Route::post('workflows/{approvalRequest}/cancel', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEngineController::class, 'cancel']);
            Route::post('workflows/{approvalRequest}/retry-release', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEngineController::class, 'retryRelease']);

            Route::get('approval-tasks', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEngineController::class, 'inbox']);
            Route::post('approval-tasks/{task}/decide', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEngineController::class, 'decide']);

            // Phase 2 + Phase 3
            Route::post('versions/{version}/lint', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEnginePhase23Controller::class, 'lint']);
            Route::put('versions/{version}/draft', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEnginePhase23Controller::class, 'updateDraft']);
            Route::get('simulation-catalog', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEnginePhase23Controller::class, 'simulationCatalog']);
            Route::post('definitions/{workflow}/simulate', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEnginePhase23Controller::class, 'simulate']);
            Route::get('analytics', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEnginePhase23Controller::class, 'analytics']);
            Route::post('workflows/{approvalRequest}/governance', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEnginePhase23Controller::class, 'recordGovernance']);
            Route::post('workflows/{approvalRequest}/external-approval', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEnginePhase23Controller::class, 'recordExternal']);
            Route::post('workflows/{approvalRequest}/sla/pause', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEnginePhase23Controller::class, 'pauseSla']);
            Route::post('workflows/{approvalRequest}/sla/resume', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEnginePhase23Controller::class, 'resumeSla']);
            Route::post('approval-tasks/{task}/claim', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEnginePhase23Controller::class, 'claimTask']);
            Route::get('calendars', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEnginePhase23Controller::class, 'calendars']);
            Route::post('calendars', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEnginePhase23Controller::class, 'storeCalendar']);
            Route::get('ai/guards', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEnginePhase23Controller::class, 'aiGuards']);
            Route::post('ai/suggestions', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEnginePhase23Controller::class, 'aiSuggest']);
            Route::post('ai/suggestions/{suggestion}/apply', [\App\Http\Controllers\Api\V1\WorkflowEngine\WorkflowEnginePhase23Controller::class, 'aiApply']);
        });

        // SAAM — Signature & Approval Authentication Module
        Route::prefix('saam')->group(function () {
            Route::get('profile', [\App\Http\Controllers\Api\V1\Saam\SignatureProfileController::class, 'show']);
            Route::post('profile/draw', [\App\Http\Controllers\Api\V1\Saam\SignatureProfileController::class, 'draw']);
            Route::post('profile/upload', [\App\Http\Controllers\Api\V1\Saam\SignatureProfileController::class, 'upload']);
            Route::delete('profile/{type}', [\App\Http\Controllers\Api\V1\Saam\SignatureProfileController::class, 'revoke']);

            Route::get('signature-image/{signatureVersion}', [\App\Http\Controllers\Api\V1\Saam\SignatureImageController::class, 'show'])
                ->name('saam.signature-image');

            Route::post('sign/{signable_type}/{signable_id}', [\App\Http\Controllers\Api\V1\Saam\SignatureEventController::class, 'store']);
            Route::get('events/{signable_type}/{signable_id}', [\App\Http\Controllers\Api\V1\Saam\SignatureEventController::class, 'index']);
            Route::get('my-events', [\App\Http\Controllers\Api\V1\Saam\SignatureEventController::class, 'myEvents']);

            Route::get('delegations', [\App\Http\Controllers\Api\V1\Saam\DelegationController::class, 'index']);
            Route::post('delegations', [\App\Http\Controllers\Api\V1\Saam\DelegationController::class, 'store']);
            Route::delete('delegations/{delegation}', [\App\Http\Controllers\Api\V1\Saam\DelegationController::class, 'destroy']);

            Route::post('documents/generate/{signable_type}/{signable_id}', [\App\Http\Controllers\Api\V1\Saam\SignedDocumentController::class, 'generate']);
            Route::get('documents/{signable_type}/{signable_id}', [\App\Http\Controllers\Api\V1\Saam\SignedDocumentController::class, 'show']);
            Route::get('documents/download/{document}', [\App\Http\Controllers\Api\V1\Saam\SignedDocumentController::class, 'download']);
        });

        // SRHR — Field Researcher Deployment & Reporting Module
        Route::prefix('srhr')->group(function () {
            // Parliaments
            Route::get('parliaments', [\App\Http\Controllers\Api\V1\Srhr\ParliamentController::class, 'index']);
            Route::post('parliaments', [\App\Http\Controllers\Api\V1\Srhr\ParliamentController::class, 'store']);
            Route::get('parliaments/{parliament}', [\App\Http\Controllers\Api\V1\Srhr\ParliamentController::class, 'show']);
            Route::put('parliaments/{parliament}', [\App\Http\Controllers\Api\V1\Srhr\ParliamentController::class, 'update']);
            Route::delete('parliaments/{parliament}', [\App\Http\Controllers\Api\V1\Srhr\ParliamentController::class, 'destroy']);

            // Staff Deployments
            Route::get('deployments', [\App\Http\Controllers\Api\V1\Srhr\StaffDeploymentController::class, 'index']);
            Route::post('deployments', [\App\Http\Controllers\Api\V1\Srhr\StaffDeploymentController::class, 'store']);
            Route::get('deployments/{staffDeployment}', [\App\Http\Controllers\Api\V1\Srhr\StaffDeploymentController::class, 'show']);
            Route::put('deployments/{staffDeployment}', [\App\Http\Controllers\Api\V1\Srhr\StaffDeploymentController::class, 'update']);
            Route::delete('deployments/{staffDeployment}', [\App\Http\Controllers\Api\V1\Srhr\StaffDeploymentController::class, 'destroy']);
            Route::post('deployments/{staffDeployment}/recall', [\App\Http\Controllers\Api\V1\Srhr\StaffDeploymentController::class, 'recall']);
            Route::post('deployments/{staffDeployment}/complete', [\App\Http\Controllers\Api\V1\Srhr\StaffDeploymentController::class, 'complete']);

            // Researcher Reports
            Route::get('reports', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportController::class, 'index']);
            Route::post('reports', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportController::class, 'store']);
            Route::get('reports/{researcherReport}', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportController::class, 'show']);
            Route::put('reports/{researcherReport}', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportController::class, 'update']);
            Route::delete('reports/{researcherReport}', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportController::class, 'destroy']);
            Route::post('reports/{researcherReport}/submit', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportController::class, 'submit']);
            Route::post('reports/{researcherReport}/acknowledge', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportController::class, 'acknowledge']);
            Route::post('reports/{researcherReport}/request-revision', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportController::class, 'requestRevision']);

            // Report Attachments
            Route::get('reports/{researcherReport}/attachments', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportAttachmentController::class, 'index']);
            Route::post('reports/{researcherReport}/attachments', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportAttachmentController::class, 'store']);
            Route::delete('reports/{researcherReport}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportAttachmentController::class, 'destroy']);
            Route::get('reports/{researcherReport}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Srhr\ResearcherReportAttachmentController::class, 'download']);
        });

        require __DIR__.'/api/risk.php';

        // Weekly Summary (email digest — existing)
        Route::prefix('weekly-summary')->group(function () {
            Route::get('preferences/me', [\App\Http\Controllers\Api\V1\WeeklySummary\WeeklySummaryController::class, 'getPreferences']);
            Route::put('preferences/me', [\App\Http\Controllers\Api\V1\WeeklySummary\WeeklySummaryController::class, 'updatePreferences']);
            Route::get('reports', [\App\Http\Controllers\Api\V1\WeeklySummary\WeeklySummaryController::class, 'listReports']);
            Route::get('reports/{report}', [\App\Http\Controllers\Api\V1\WeeklySummary\WeeklySummaryController::class, 'showReport']);
        });

        Route::prefix('admin/weekly-summary')->middleware('role:System Admin')->group(function () {
            Route::get('runs', [\App\Http\Controllers\Api\V1\WeeklySummary\WeeklySummaryController::class, 'listRuns']);
            Route::post('run', [\App\Http\Controllers\Api\V1\WeeklySummary\WeeklySummaryController::class, 'triggerRun']);
        });

        // Weekly Summary Reports (operational progress reporting — PRD Phase 1)
        Route::prefix('weekly-summaries')->group(function () {
            Route::get('dashboard', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'dashboard']);
            Route::get('review-queue', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'reviewQueue']);
            Route::get('trends', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'trends']);
            Route::get('periods', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'periods']);
            Route::post('periods', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'storePeriod']);
            Route::get('current', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'current']);
            Route::get('current/suggestions', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'suggestions']);
            Route::post('/', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'store']);
            Route::post('department', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'department']);
            Route::post('institutional', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'institutional']);
            Route::post('exemptions', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'exemptions']);
            Route::get('{weeklySummary}', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'show']);
            Route::put('{weeklySummary}', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'update']);
            Route::post('{weeklySummary}/items', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'storeItem']);
            Route::post('{weeklySummary}/submit', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'submit']);
            Route::post('{weeklySummary}/return', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'returnReport']);
            Route::post('{weeklySummary}/accept', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'accept']);
            Route::post('{weeklySummary}/reopen', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'reopen']);
            Route::post('{weeklySummary}/include-suggestion', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'includeSuggestion']);
            Route::post('{weeklySummary}/exclude-suggestion', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'excludeSuggestion']);
            Route::post('{weeklySummary}/ai-draft', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'generateAiDraft']);
            Route::post('{weeklySummary}/ai-draft/confirm', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'confirmAiDraft']);
            Route::post('{weeklySummary}/consolidate-item', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'consolidateItem']);
            Route::post('{weeklySummary}/publish', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'publish']);
            Route::post('{weeklySummary}/extend-deadline', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'extendDeadline']);
            Route::get('{weeklySummary}/export/{format}', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'export']);
        });
        Route::post('weekly-summary-items/{weeklySummaryItem}/create-assignment', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'createAssignmentFromItem']);
        Route::post('weekly-summary-items/{weeklySummaryItem}/record-decision', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'recordDecision'])
            ->whereNumber('weeklySummaryItem');
        Route::post('weekly-summary-items/{weeklySummaryItem}/carry-forward', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'carryForward']);
        Route::post('weekly-report-risks/{weeklyReportRisk}/create-risk', [\App\Http\Controllers\Api\V1\WeeklyReports\WeeklyReportController::class, 'createRiskFromWeekly']);

        require __DIR__.'/api/audit-management.php';

        require __DIR__.'/api/people-authority.php';

        // Employee Lifecycle Module (Phase 1)
        Route::prefix('lifecycle')->group(function () {
            $lc = \App\Http\Controllers\Api\V1\Lifecycle\LifecycleController::class;
            $lt = \App\Http\Controllers\Api\V1\Lifecycle\LifecycleTemplateController::class;

            Route::middleware('can:lifecycle.view')->get('dashboard', [$lc, 'dashboard']);
            Route::middleware('can:lifecycle.view')->get('analytics', [$lc, 'analytics']);
            Route::middleware('can:lifecycle.view')->get('cases', [$lc, 'listCases']);
            Route::middleware('can:lifecycle.manage-onboarding')->post('journeys', [$lc, 'initiateJourney']);
            Route::get('my-tasks', [$lc, 'myTasks']);

            Route::middleware('can:lifecycle.manage-onboarding')->post('onboarding', [$lc, 'initiateOnboarding']);
            Route::middleware('can:lifecycle.manage-separation')->post('separation', [$lc, 'initiateSeparation']);

            Route::middleware('can:lifecycle.view')->get('cases/{lifecycleCase}', [$lc, 'show']);
            Route::middleware('can:lifecycle.view')->get('cases/{lifecycleCase}/tasks', [$lc, 'tasks']);
            Route::middleware('can:lifecycle.view')->get('cases/{lifecycleCase}/timeline', [$lc, 'timeline']);

            Route::post('tasks/{lifecycleTask}/complete', [$lc, 'completeTask']);
            Route::middleware('can:lifecycle.admin')->post('tasks/{lifecycleTask}/reopen', [$lc, 'reopenTask']);

            Route::middleware('can:lifecycle.complete-department-tasks')->post('tasks/{lifecycleTask}/clearance', [$lc, 'updateClearance']);
            Route::middleware('can:lifecycle.complete-department-tasks')->post('tasks/{lifecycleTask}/exceptions', [$lc, 'requestException']);
            Route::middleware('can:lifecycle.approve-exceptions')->post('exceptions/{lifecycleException}/approve', [$lc, 'approveException']);

            Route::middleware('can:lifecycle.manage-separation')->get('cases/{lifecycleCase}/terminal-payment', [$lc, 'assertTerminalPayment']);
            Route::middleware('can:lifecycle.manage-separation')->post('cases/{lifecycleCase}/terminal-payment', [$lc, 'approveTerminalPayment']);
            Route::middleware('can:lifecycle.finalise-separation')->post('cases/{lifecycleCase}/finalise', [$lc, 'finaliseSeparation']);

            Route::middleware('can:lifecycle.templates.view')->get('templates', [$lt, 'index']);
            Route::middleware('can:lifecycle.templates.edit')->post('templates', [$lt, 'store']);
            Route::middleware('can:lifecycle.templates.view')->get('templates/{lifecycleTemplateVersion}', [$lt, 'show']);
            Route::middleware('can:lifecycle.templates.publish')->post('templates/{lifecycleTemplateVersion}/publish', [$lt, 'publish']);
        });

        // Admin Workflows
        Route::prefix('admin/workflows')->group(function () {
            Route::get('/', [\App\Http\Controllers\Api\V1\Admin\WorkflowAdminController::class, 'index']);
            Route::get('module-catalogue', [\App\Http\Controllers\Api\V1\Admin\WorkflowAdminController::class, 'moduleCatalogue']);
            Route::post('/', [\App\Http\Controllers\Api\V1\Admin\WorkflowAdminController::class, 'store']);
            Route::put('{workflow}', [\App\Http\Controllers\Api\V1\Admin\WorkflowAdminController::class, 'update']);
            Route::delete('{workflow}', [\App\Http\Controllers\Api\V1\Admin\WorkflowAdminController::class, 'destroy']);
        });
    });
});
