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

// Travel visa appointment/expiry reminders.
Schedule::command('travel:send-visa-reminders')->dailyAt('07:45');

// Travel retirement overdue marking + due-soon reminders.
Schedule::command('travel:mark-overdue-retirements')->dailyAt('08:10');

// Post configured annual leave accruals into the auditable leave ledger.
Schedule::command('leave:post-monthly-accruals')->monthlyOn(1, '02:00');

// Expire overdue leave-in-lieu credits and remind staff before expiry.
Schedule::command('leave:manage-toil-expiry')->dailyAt('08:20');

// Assignment reminders + unclaimed/overdue escalations.
Schedule::command('assignments:process-reminders')->hourly();
// Google Calendar two-way sync (no-op when GOOGLE_CALENDAR_* credentials absent).
Schedule::command('assignments:sync-google-calendar')->hourly()->withoutOverlapping();

// Evaluate automated Key Risk Indicators and raise in-app breach alerts.
Schedule::command('risk:evaluate-kris')->weekdays()->at('07:20');

// Mark overdue control-testing campaign items.
Schedule::command('risk:mark-control-tests-overdue')->weekdays()->at('07:25');

// Idempotent weekly promote of open decisions/resolutions into Assignments feed.
Schedule::command('decisions:promote-weekly-assignments')->mondays()->at('07:35');

// Correspondence deadline overdue notifications + HOD escalation after 3 days.
Schedule::command('correspondence:escalate-deadlines')->dailyAt('08:05');

// Notify (never reassign/auto-approve) approvers of overdue workflow steps,
// escalating to their supervisor after a sustained breach.
Schedule::command('workflow:escalate-overdue')->hourly()->withoutOverlapping();

// Poll designated registry mailbox into suggestions only (requires IMAP config or is a no-op when disabled).
Schedule::command('correspondence:poll-mailbox')->everyFifteenMinutes()->withoutOverlapping();

// Drain HTTP OCR jobs when DOCUMENT_OCR_DRIVER=http (no-op for null driver / empty queue).
Schedule::command('documents:process-ocr-jobs')->everyFiveMinutes()->withoutOverlapping();

// Fleet telematics poll — only when schedule flag + a poll-capable driver are enabled.
if (config('fleet_telematics.schedule_enabled')
    && in_array(strtolower((string) config('fleet_telematics.driver', 'null')), ['generic_http'], true)
) {
    Schedule::command('fleet:sync-telematics')->everyFifteenMinutes()->withoutOverlapping();
}

// Generate and send weekly institutional summary emails to all active users every Friday at 16:00.
Schedule::job(new \App\Jobs\RunWeeklySummaryBatchJob)
    ->fridays()
    ->at('16:00')
    ->withoutOverlapping()
    ->onOneServer();

// Compliance digests for missing individual weekly summaries (Mon after weekend close).
Schedule::command('weekly-reports:send-compliance-digest')->mondays()->at('08:40');

// Queue approved recurring management-information reports.
Schedule::command('reports:dispatch-scheduled')->everyFiveMinutes()->withoutOverlapping();

// People & Authority — automated role recertification (opens campaigns only; never auto-decides)
if (config('people_authority.recertification_schedule_enabled')) {
    Schedule::command('people-authority:open-recertifications')->weeklyOn(1, '07:50')->withoutOverlapping();
}

// Notifications Phase 1+2 — outbox, retries, digests, coalesce, ack reminders, maintenance
Schedule::command('notifications:process-outbox')->everyMinute()->withoutOverlapping();
Schedule::command('notifications:process-deliveries --retries --scheduled --coalesce --ack-reminders')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('notifications:process-deliveries --digest=daily')->dailyAt('07:10');
Schedule::command('notifications:process-deliveries --digest=weekly')->weeklyOn(1, '07:15');
Schedule::command('notifications:process-deliveries --maintenance')->hourly()->withoutOverlapping();
