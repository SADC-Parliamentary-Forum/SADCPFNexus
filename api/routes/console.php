<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Check all budget lines for over-spend or nearing-limit conditions and
// dispatch in-app / email notifications to Finance Controller and SG.
// Runs every weekday morning at 07:00.
Schedule::command('budget:check-variance')->weekdays()->at('07:00');

// Prune signed action tokens that are expired AND older than 30 days.
// Keeps the table lean while retaining recent tokens for audit purposes.
Schedule::call(function () {
    \App\Models\SignedActionToken::where('expires_at', '<', now()->subDays(30))->delete();
})->daily()->name('prune-expired-action-tokens');
