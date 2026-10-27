<?php

// /api/v1/fleet routes. Required from routes/api.php inside the authenticated
// group (auth:sanctum, session check, throttle, SetRlsContext, idempotency) —
// never register these routes outside that group.

use Illuminate\Support\Facades\Route;

// Fleet ops layer on vehicle Fixed Assets (category=fleet)
Route::prefix('fleet')->group(function () {
    $fleet = \App\Http\Controllers\Api\V1\Fleet\FleetController::class;
    Route::get('vehicles', [$fleet, 'index']);
    Route::get('vehicles/{asset}', [$fleet, 'show']);
    Route::put('vehicles/{asset}/gps', [$fleet, 'updateGps']);
    Route::put('vehicles/{asset}/telematics', [$fleet, 'updateTelematics']);
    Route::get('drivers', [$fleet, 'listDrivers']);
    Route::post('drivers', [$fleet, 'storeDriver']);
    Route::get('bookings', [$fleet, 'listBookings']);
    Route::post('bookings', [$fleet, 'storeBooking']);
    Route::post('vehicles/{asset}/trips', [$fleet, 'storeTrip']);
    Route::post('vehicles/{asset}/fuel-logs', [$fleet, 'storeFuelLog']);
    Route::post('vehicles/{asset}/service-schedules', [$fleet, 'storeServiceSchedule']);
    Route::get('utilisation', \App\Http\Controllers\Api\V1\Fleet\FleetUtilisationController::class);
});
