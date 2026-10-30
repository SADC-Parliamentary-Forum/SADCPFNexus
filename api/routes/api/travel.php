<?php

// /api/v1/travel routes. Required from routes/api.php inside the authenticated
// group (auth:sanctum, session check, throttle, SetRlsContext, idempotency) —
// never register these routes outside that group.

use Illuminate\Support\Facades\Route;

// Travel Module
Route::prefix('travel')->group(function () {
    Route::get('register/export', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'registerExport']);
    Route::get('destinations', [\App\Http\Controllers\Api\V1\Travel\TravelDestinationController::class, 'index']);
    Route::post('destinations/countries', [\App\Http\Controllers\Api\V1\Travel\TravelDestinationController::class, 'storeCountry']);
    Route::post('destinations/cities', [\App\Http\Controllers\Api\V1\Travel\TravelDestinationController::class, 'storeCity']);
    Route::get('dsa-rates', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'dsaRatesIndex']);
    Route::post('dsa-rates', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'dsaRatesStore']);
    Route::get('toil', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'toilIndex']);
    Route::get('toil/mine', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'toilMine']);
    Route::post('toil/{candidate}/confirm', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'toilConfirm']);
    Route::post('toil/{candidate}/authorise-ot', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'toilAuthoriseOt']);
    Route::post('toil/{candidate}/confirm-duty', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'toilConfirmDuty']);
    Route::post('toil/{candidate}/hr-validate', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'toilHrValidate']);
    Route::post('toil/{candidate}/reject', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'toilReject']);
    Route::post('toil/{candidate}/extend', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'toilExtend']);
    Route::get('missions', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'missionsIndex']);
    Route::get('missions/{mission}', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'missionsShow']);
    Route::get('analytics/summary', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'analyticsSummary']);
    Route::get('visa-reminders', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'visaReminders']);
    Route::get('fx-rates', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'fxRatesIndex']);
    Route::post('fx-rates', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'fxRatesStore']);
    Route::get('dashboards/traveller', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'dashboardTraveller']);
    Route::get('dashboards/admin', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'dashboardAdmin']);
    Route::get('dashboards/finance', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'dashboardFinance']);
    Route::get('calendar', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'calendar']);
    Route::get('reports/pack', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'reportsPack']);
    Route::get('reports/pack/export', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'reportsPackExport']);
    Route::get('travellers', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'travellers']);
    Route::get('fleet-vehicles', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'fleetVehicles']);
    Route::get('sponsored-deduction-rates', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'sponsoredRatesIndex']);
    Route::post('sponsored-deduction-rates', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'sponsoredRatesStore']);

    Route::apiResource('requests', \App\Http\Controllers\Api\V1\Travel\TravelController::class)
        ->parameters(['requests' => 'travelRequest'])
        ->names('travel.requests');
    Route::post('requests/{travelRequest}/submit', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'submit']);
    Route::post('requests/{travelRequest}/approve', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'approve']);
    Route::post('requests/{travelRequest}/reject', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'reject']);
    Route::post('requests/{travelRequest}/cancel', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'cancel']);
    Route::post('requests/{travelRequest}/return', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'returnForCorrection']);
    Route::post('requests/{travelRequest}/withdraw', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'withdraw']);
    Route::post('requests/{travelRequest}/resubmit', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'resubmit']);
    Route::get('requests/{travelRequest}/certificate', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'certificate']);
    Route::get('requests/{travelRequest}/pdf', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'pdf']);
    Route::get('requests/{travelRequest}/travel-pack', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'travelPack']);
    Route::post('requests/{travelRequest}/accommodations', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'storeAccommodation']);
    Route::patch('requests/{travelRequest}/vehicle-mileage', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'updateVehicleMileage']);
    Route::post('requests/{travelRequest}/assign-vehicle', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'assignVehicle']);
    Route::patch('requests/{travelRequest}/personal-days', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'updatePersonalDays']);
    Route::post('requests/{travelRequest}/link-imprest', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'linkImprest']);
    Route::patch('requests/{travelRequest}/visa', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'updateVisa']);
    Route::patch('requests/{travelRequest}/health', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'updateHealth']);
    Route::patch('requests/{travelRequest}/procurement-link', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'updateProcurementLink']);
    Route::post('requests/{travelRequest}/parse-itinerary', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'parseItinerary']);
    Route::post('requests/{travelRequest}/apply-itinerary', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'applyItinerary']);
    Route::post('requests/{travelRequest}/dsa', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'saveDsa']);
    Route::post('requests/{travelRequest}/confirm-funds', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'confirmFunds']);
    Route::post('requests/{travelRequest}/mark-booked', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'markBooked']);
    Route::post('requests/{travelRequest}/mark-returned', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'markReturned']);
    Route::post('requests/{travelRequest}/complete-retirement', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'completeRetirement']);
    Route::post('requests/{travelRequest}/amendments', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'requestAmendment']);
    Route::post('amendments/{amendment}/approve', [\App\Http\Controllers\Api\V1\Travel\TravelController::class, 'approveAmendment']);
    // Travel attachments
    Route::get('requests/{travelRequest}/attachments', [\App\Http\Controllers\Api\V1\Travel\TravelAttachmentController::class, 'index']);
    Route::post('requests/{travelRequest}/attachments', [\App\Http\Controllers\Api\V1\Travel\TravelAttachmentController::class, 'store']);
    Route::delete('requests/{travelRequest}/attachments/{attachment}', [\App\Http\Controllers\Api\V1\Travel\TravelAttachmentController::class, 'destroy']);
    Route::get('requests/{travelRequest}/attachments/{attachment}/download', [\App\Http\Controllers\Api\V1\Travel\TravelAttachmentController::class, 'download']);
});
