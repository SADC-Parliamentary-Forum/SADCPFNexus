<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Models\User;
use App\Modules\Alerts\Services\AlertsService;
use App\Services\NotificationService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Sends a daily alert digest email to key managers per tenant.
 * Covers: staff away today, active missions, upcoming deadlines (14 days),
 * and events scheduled this week.
 *
 * Scheduled daily at 07:00 via routes/console.php.
 */
class SendAlertDigest extends Command
{
    protected $signature   = 'app:send-alert-digest';
    protected $description = 'Email a daily alert digest to managers and admins for each tenant';

    public function handle(AlertsService $alerts, NotificationService $notif): int
    {
        $today      = Carbon::today()->toFormattedDayDateString(); // e.g. "Thu, Apr 9, 2026"
        $portalUrl  = env('APP_FRONTEND_URL', config('app.url'));
        $dispatched = 0;

        $tenants = Tenant::all();

        foreach ($tenants as $tenant) {
            // Resolve a context user for AlertsService (uses tenant_id filtering)
            $contextUser = User::where('tenant_id', $tenant->id)->first();
            if (! $contextUser) {
                continue;
            }

            $summary = $alerts->getSummary($contextUser);

            // Skip tenants with nothing to report
            $hasContent = $summary['away_today']->isNotEmpty()
                || $summary['active_missions']->isNotEmpty()
                || $summary['upcoming_deadlines']->isNotEmpty()
                || $summary['events_this_week']->isNotEmpty()
                || $summary['un_days_upcoming']->isNotEmpty();

            if (! $hasContent) {
                continue;
            }

            $digest = $this->buildDigestText($summary);

            // Notify all key managers in this tenant
            $recipients = User::where('tenant_id', $tenant->id)
                ->whereHas('roles', fn ($q) => $q->whereIn('name', [
                    'System Admin',
                    'HR Manager',
                    'Finance Controller',
                    'Secretary General',
                    'system_admin',
                    'hr_manager',
                    'finance_controller',
                    'secretary_general',
                ]))
                ->get();

            foreach ($recipients as $recipient) {
                $notif->dispatch($recipient, 'alerts.daily_digest', [
                    'name'       => $recipient->name,
                    'date'       => $today,
                    'digest'     => $digest,
                    'portal_url' => $portalUrl,
                ], [
                    'module' => 'alerts',
                    'url'    => '/dashboard',
                ]);
                $dispatched++;
            }
        }

        $this->info("Alert digest sent to {$dispatched} recipient(s).");

        return self::SUCCESS;
    }

    private function buildDigestText(array $summary): string
    {
        $lines = [];

        if ($summary['away_today']->isNotEmpty()) {
            $lines[] = '--- STAFF AWAY TODAY ---';
            foreach ($summary['away_today'] as $item) {
                $type = ucfirst($item->type ?? 'away');
                $lines[] = "  • {$item->name} ({$type}) — {$item->from_date} to {$item->to_date}";
            }
            $lines[] = '';
        }

        if ($summary['active_missions']->isNotEmpty()) {
            $lines[] = '--- ACTIVE MISSIONS ---';
            foreach ($summary['active_missions'] as $m) {
                $lines[] = "  • {$m->reference_number}: {$m->requester_name} → {$m->destination_country} (returns {$m->return_date})";
            }
            $lines[] = '';
        }

        if ($summary['upcoming_deadlines']->isNotEmpty()) {
            $lines[] = '--- UPCOMING DEADLINES (next 14 days) ---';
            foreach ($summary['upcoming_deadlines'] as $d) {
                $responsible = $d->responsible ?? '—';
                $lines[] = "  • {$d->title} [{$d->module}] — due {$d->deadline_date} ({$responsible})";
            }
            $lines[] = '';
        }

        if ($summary['events_this_week']->isNotEmpty()) {
            $lines[] = '--- EVENTS THIS WEEK ---';
            foreach ($summary['events_this_week'] as $e) {
                $lines[] = "  • {$e->title} ({$e->date})";
            }
            $lines[] = '';
        }

        if ($summary['un_days_upcoming']->isNotEmpty()) {
            $lines[] = '--- UPCOMING UN/CALENDAR EVENTS ---';
            foreach ($summary['un_days_upcoming'] as $u) {
                $lines[] = "  • {$u->title} ({$u->date})";
            }
            $lines[] = '';
        }

        return implode("\n", $lines);
    }
}
