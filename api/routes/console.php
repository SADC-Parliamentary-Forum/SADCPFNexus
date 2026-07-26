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

// Send daily alert digest (away today, active missions, deadlines, events) to key managers.
Schedule::command('app:send-alert-digest')->weekdays()->at('07:00');

// Send imprest retirement reminders to staff whose imprests are due within 7 days.
Schedule::command('app:send-imprest-reminders')->dailyAt('08:00');

// Remind M&E report owners of overdue activity reports.
Schedule::command('mande:send-overdue-reminders')->dailyAt('08:30');

// Vendor compliance document expiry reminders for Procurement Officers.
Schedule::command('procurement:send-document-expiry-reminders')->dailyAt('08:15');

// Travel TOIL candidates catch-up (mark-returned + nightly; never auto-creates leave).
Schedule::command('travel:generate-toil-candidates')->dailyAt('01:30');

// Generate and send weekly institutional summary emails to all active users every Friday at 16:00.
Schedule::job(new \App\Jobs\RunWeeklySummaryBatchJob())
    ->fridays()
    ->at('16:00')
    ->withoutOverlapping()
    ->onOneServer();
