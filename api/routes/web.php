<?php

use App\Http\Controllers\EmailApprovalController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    abort(404);
});

// Email-based approval routes — unauthenticated; token provides access control.
// Rate-limited to prevent token enumeration attacks.
Route::prefix('email-approval')->name('email-approval.')->middleware('throttle:10,1')->group(function () {
    Route::get('approve/{token}', [EmailApprovalController::class, 'approve'])->name('approve');
    Route::get('reject/{token}',  [EmailApprovalController::class, 'rejectForm'])->name('reject.form');
    Route::post('reject/{token}', [EmailApprovalController::class, 'rejectSubmit'])->name('reject.submit');
});
