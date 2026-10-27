<?php

// /api/v1/people-authority routes. Required from routes/api.php inside the authenticated
// group (auth:sanctum, session check, throttle, SetRlsContext, idempotency) —
// never register these routes outside that group.

use Illuminate\Support\Facades\Route;

// People & Authority Module (Phase 1)
Route::prefix('people-authority')->group(function () {
    $pa = \App\Http\Controllers\Api\V1\PeopleAuthority\PeopleAuthorityController::class;

    Route::get('me', [$pa, 'me']);
    Route::get('reports', [$pa, 'reports']);

    Route::middleware('can:people.view-directory')->group(function () use ($pa) {
        Route::get('people', [$pa, 'peopleIndex']);
        Route::get('organisation/chart', [$pa, 'orgChart']);
    });

    Route::middleware('can:people.view-profile')->get('people/{person}', [$pa, 'peopleShow']);
    Route::middleware('can:people.view-profile')->get('people/{person}/profile', [$pa, 'peopleProfile']);
    Route::middleware('can:people.manage')->post('people', [$pa, 'peopleStore']);
    Route::middleware('can:people.manage')->post('people/sync-from-users', [$pa, 'peopleSyncFromUsers']);
    Route::middleware('can:people.manage')->post('people/remove-supplier-links', [$pa, 'peopleRemoveSupplierLinks']);
    Route::middleware('can:people.manage')->put('people/{person}', [$pa, 'peopleUpdate']);
    Route::middleware('can:people.manage')->post('people/{person}/link-account', [$pa, 'linkAccount']);
    Route::post('people/{person}/change-requests', [$pa, 'changeRequestStore']);

    Route::middleware('can:organisation.view')->get('organisation/units', [$pa, 'unitsIndex']);
    Route::middleware('can:organisation.manage')->post('organisation/units', [$pa, 'unitsStore']);

    Route::middleware('can:organisation.view')->get('positions', [$pa, 'positionsIndex']);
    Route::middleware('can:positions.manage')->post('positions', [$pa, 'positionsStore']);
    Route::middleware('can:positions.manage')->post('positions/{position}/assign', [$pa, 'positionAssign']);
    Route::middleware('can:positions.manage')->post('positions/{position}/vacate', [$pa, 'positionVacate']);
    Route::middleware('can:reporting-lines.manage')->post('reporting-relationships', [$pa, 'reportingStore']);

    Route::get('job-descriptions', [$pa, 'jobDescriptionsIndex']);
    Route::middleware('can:positions.manage')->post('job-descriptions', [$pa, 'jobDescriptionsStore']);
    Route::post('job-descriptions/{jobDescription}/acknowledge', [$pa, 'jobDescriptionAcknowledge']);

    Route::middleware('can:roles.view')->get('roles', [$pa, 'rolesIndex']);
    Route::middleware('can:roles.assign')->post('users/{user}/roles', [$pa, 'userRolesStore']);
    Route::middleware('can:roles.approve')->post('user-roles/{userRole}/approve', [$pa, 'userRolesApprove']);
    Route::middleware('can:roles.revoke')->post('user-roles/{userRole}/revoke', [$pa, 'userRolesRevoke']);

    Route::middleware('can:authorities.manage')->get('authorities', [$pa, 'authoritiesIndex']);
    Route::middleware('can:authorities.manage')->post('authorities', [$pa, 'authoritiesStore']);
    Route::middleware('can:authorities.manage')->post('authority-assignments', [$pa, 'authorityAssignmentsStore']);
    Route::post('authority/check', [$pa, 'authorityCheck']);

    Route::get('acting-appointments', [$pa, 'actingIndex']);
    Route::middleware('can:acting-appointments.create')->post('acting-appointments', [$pa, 'actingStore']);
    Route::middleware('can:acting-appointments.approve')->post('acting-appointments/{actingAppointment}/approve', [$pa, 'actingApprove']);

    Route::get('delegations', [$pa, 'delegationsIndex']);
    Route::middleware('can:delegations.create')->post('delegations', [$pa, 'delegationsStore']);
    Route::middleware('can:delegations.approve')->post('delegations/{delegation}/approve', [$pa, 'delegationsApprove']);
    Route::middleware('can:delegations.revoke')->post('delegations/{delegation}/revoke', [$pa, 'delegationsRevoke']);

    Route::middleware('can:signatures.enrol')->post('signatures/enrol', [$pa, 'signaturesEnrol']);
    Route::middleware('can:signatures.administer')->post('signatures/{signature}/activate', [$pa, 'signaturesActivate']);
    Route::middleware('can:signatures.administer')->post('signatures/{signature}/suspend', [$pa, 'signaturesSuspend']);
    Route::middleware('can:signatures.administer')->post('signatures/{signature}/revoke', [$pa, 'signaturesRevoke']);
    Route::middleware('can:documents.sign')->post('documents/sign', [$pa, 'documentsSign']);
    Route::get('documents/signatures', [$pa, 'documentsSignatures']);

    Route::middleware('can:onboarding.manage')->post('onboarding', [$pa, 'onboardingStore']);
    Route::middleware('can:offboarding.manage')->post('offboarding', [$pa, 'offboardingStore']);
    Route::middleware('can:people.manage')->post('transfers', [$pa, 'transfersStore']);
    Route::middleware('can:access-reviews.manage')->post('access-reviews', [$pa, 'accessReviewsStore']);

    // Phase 2 / 3
    $pa23 = \App\Http\Controllers\Api\V1\PeopleAuthority\PeopleAuthorityPhase23Controller::class;
    Route::middleware('can:people.certificate.enrol')->post('signatures/certificate-enrol', [$pa23, 'enrolCertificate']);
    Route::middleware('can:people.esign.manage')->get('esign-requests', [$pa23, 'listEsign']);
    Route::middleware('can:people.esign.manage')->post('esign-requests', [$pa23, 'storeEsign']);
    Route::middleware('can:people.esign.manage')->post('esign-requests/{esignRequest}/submit', [$pa23, 'submitEsign']);
    Route::middleware('can:people.m365.sync')->get('directory-sync', [$pa23, 'listDirectorySync']);
    Route::middleware('can:people.m365.sync')->post('directory-sync', [$pa23, 'runDirectorySync']);
    Route::middleware('can:people.recertification.manage')->post('recertification-campaigns', [$pa23, 'openRecertification']);
    Route::middleware('can:people.sod.analyse')->get('sod-reports', [$pa23, 'listSodReports']);
    Route::middleware('can:people.sod.analyse')->post('sod-reports', [$pa23, 'analyseSod']);
    Route::middleware('can:people.org-scenarios.manage')->get('org-scenarios', [$pa23, 'listOrgScenarios']);
    Route::middleware('can:people.org-scenarios.manage')->post('org-scenarios', [$pa23, 'storeOrgScenario']);
    Route::middleware('can:people.payroll-link.manage')->post('employment/{employment}/payroll-link', [$pa23, 'linkPayroll']);
    Route::middleware('can:people.payroll-link.manage')->post('employment/payroll-export', [$pa23, 'exportPayrollLinks']);
    Route::middleware('can:people.signatures.publish-verify')->post('documents/signatures/{signature}/publish-verification', [$pa23, 'publishSignatureVerify']);

    Route::middleware('can:people.succession.manage')->get('succession-plans', [$pa23, 'listSuccession']);
    Route::middleware('can:people.succession.manage')->post('succession-plans', [$pa23, 'storeSuccession']);
    Route::middleware('can:people.skills.manage')->get('skills', [$pa23, 'listSkills']);
    Route::middleware('can:people.skills.manage')->post('skills', [$pa23, 'storeSkill']);
    Route::middleware('can:people.skills.manage')->post('person-skills', [$pa23, 'assignSkill']);
    Route::middleware('can:people.skills.manage')->get('people/{person}/skills', [$pa23, 'personSkills']);
    Route::middleware('can:people.privilege-alerts.manage')->post('privilege-alerts/detect', [$pa23, 'detectAnomalies']);
    Route::middleware('can:people.privilege-alerts.manage')->get('privilege-alerts', [$pa23, 'listPrivilegeAlerts']);
    Route::middleware('can:people.privilege-alerts.manage')->post('privilege-alerts/{alert}/acknowledge', [$pa23, 'acknowledgePrivilegeAlert']);
    Route::middleware('can:people.view-directory')->get('search', [$pa23, 'nlSearch']);
    Route::middleware('can:people.analytics.view')->get('analytics', [$pa23, 'analytics']);
    Route::middleware('can:people.ai.suggest')->post('ai/suggestions', [$pa23, 'aiSuggest']);
    Route::middleware('can:people.ai.apply')->post('ai/suggestions/{suggestion}/apply', [$pa23, 'aiApply']);
});
