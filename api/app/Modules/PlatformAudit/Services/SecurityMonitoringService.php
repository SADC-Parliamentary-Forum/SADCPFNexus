<?php

namespace App\Modules\PlatformAudit\Services;

use App\Models\PlatformAudit\AuditEvent;
use App\Models\PlatformAudit\AuditEventAlert;
use App\Models\PlatformAudit\SecurityMonitoringRule;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * Versioned security monitoring rules + evaluation against ingested events.
 * Feasible high-value rules only — no live SIEM vendor.
 */
class SecurityMonitoringService
{
    /**
     * @return list<array{rule_key: string, name: string, description: string, event_key_pattern: string, severity: string, threshold_count: int, window_minutes: int}>
     */
    public static function defaultCatalogue(): array
    {
        return [
            [
                'rule_key' => 'failed_logins_burst',
                'name' => 'Failed login burst',
                'description' => 'Multiple failed login events for the same actor within the window.',
                'event_key_pattern' => 'auth.login.failed',
                'severity' => 'high',
                'threshold_count' => 5,
                'window_minutes' => 15,
            ],
            [
                'rule_key' => 'privileged_role_grant',
                'name' => 'Privileged role / permission grant',
                'description' => 'Role assignment or privileged permission grant events.',
                'event_key_pattern' => 'access.role_assigned|access.permission.granted|access.role_assignment_pending|access.permission.grant_pending|identity.role.assigned|identity.permission.granted',
                'severity' => 'high',
                'threshold_count' => 1,
                'window_minutes' => 60,
            ],
            [
                'rule_key' => 'integrity_failure',
                'name' => 'Audit integrity chain failure',
                'description' => 'Integrity verification failure indicator.',
                'event_key_pattern' => 'audit.integrity.failed|integrity.chain.broken',
                'severity' => 'critical',
                'threshold_count' => 1,
                'window_minutes' => 60,
            ],
            [
                'rule_key' => 'mass_export',
                'name' => 'Mass export activity',
                'description' => 'Repeated export events that may indicate bulk data extraction.',
                'event_key_pattern' => '%.export%|%.exported|pif.record.exported|document.downloaded',
                'severity' => 'high',
                'threshold_count' => 10,
                'window_minutes' => 60,
            ],
        ];
    }

    public function ensureSeeded(?int $tenantId = null): void
    {
        foreach (self::defaultCatalogue() as $item) {
            $exists = SecurityMonitoringRule::query()
                ->where('tenant_id', $tenantId)
                ->where('rule_key', $item['rule_key'])
                ->where('status', 'active')
                ->exists();

            if ($exists) {
                continue;
            }

            SecurityMonitoringRule::create([
                'tenant_id' => $tenantId,
                'rule_key' => $item['rule_key'],
                'version' => 1,
                'name' => $item['name'],
                'description' => $item['description'],
                'event_key_pattern' => $item['event_key_pattern'],
                'severity' => $item['severity'],
                'threshold_count' => $item['threshold_count'],
                'window_minutes' => $item['window_minutes'],
                'enabled' => true,
                'status' => 'active',
                'published_at' => now(),
            ]);
        }
    }

    public function evaluateEvent(AuditEvent $event): ?AuditEventAlert
    {
        $this->ensureSeeded($event->tenant_id);
        $this->ensureSeeded(null); // global defaults

        $rules = SecurityMonitoringRule::query()
            ->where('enabled', true)
            ->where('status', 'active')
            ->where(function ($q) use ($event) {
                $q->whereNull('tenant_id')->orWhere('tenant_id', $event->tenant_id);
            })
            ->orderByDesc('version')
            ->get()
            ->unique('rule_key');

        foreach ($rules as $rule) {
            if (! $this->matchesPattern($event->event_key, $rule->event_key_pattern)) {
                continue;
            }

            $since = now()->subMinutes((int) $rule->window_minutes);
            $countQuery = AuditEvent::query()
                ->where('tenant_id', $event->tenant_id)
                ->where('occurred_at', '>=', $since);

            $this->applyPatternFilter($countQuery, $rule->event_key_pattern);

            if ($event->actor_id && str_contains($rule->rule_key, 'failed_login')) {
                $countQuery->where('actor_id', $event->actor_id);
            }

            $matching = $countQuery->orderByDesc('id')->limit(max(50, (int) $rule->threshold_count))->get();
            if ($matching->count() < (int) $rule->threshold_count) {
                continue;
            }

            // Deduplicate open alerts for same rule+actor in window
            $open = AuditEventAlert::query()
                ->where('tenant_id', $event->tenant_id)
                ->where('rule_id', $rule->id)
                ->whereIn('workflow_status', ['new', 'under_review', 'classified'])
                ->where('detected_at', '>=', $since)
                ->when($event->actor_id, fn ($q) => $q->where('actor_id', $event->actor_id))
                ->first();

            if ($open) {
                $ids = array_values(array_unique(array_merge($open->event_ids ?? [], [$event->id])));
                $open->update(['event_ids' => $ids, 'first_event_id' => $open->first_event_id ?: $event->id]);

                return $open->fresh();
            }

            return AuditEventAlert::query()->create([
                'tenant_id' => $event->tenant_id,
                'rule_id' => $rule->id,
                'reference' => 'ALRT-'.strtoupper(Str::random(8)),
                'severity' => $rule->severity,
                'first_event_id' => $event->id,
                'event_ids' => $matching->pluck('id')->all(),
                'actor_id' => $event->actor_id,
                'status' => 'open',
                'workflow_status' => 'new',
                'notes' => 'Auto-raised by rule '.$rule->rule_key.' v'.$rule->version.' (indicator only).',
                'detected_at' => now(),
            ]);
        }

        return null;
    }

    /**
     * @param  array{workflow_status?: string, classification?: ?string, conclusion?: ?string, notes?: ?string}  $data
     */
    public function transitionAlert(AuditEventAlert $alert, User $actor, array $data): AuditEventAlert
    {
        $status = $data['workflow_status'] ?? $alert->workflow_status;
        $allowed = ['new', 'under_review', 'classified', 'closed'];
        if (! in_array($status, $allowed, true)) {
            abort(422, 'Invalid workflow status.');
        }

        $alert->workflow_status = $status;
        if (array_key_exists('classification', $data)) {
            $alert->classification = $data['classification'];
        }
        if (array_key_exists('conclusion', $data)) {
            $alert->conclusion = $data['conclusion'];
        }
        if (array_key_exists('notes', $data)) {
            $alert->notes = $data['notes'];
        }
        $alert->reviewed_by = $actor->id;
        $alert->reviewed_at = now();

        if ($status === 'closed') {
            $alert->status = 'closed';
            $alert->closed_at = now();
        } elseif ($status === 'under_review' || $status === 'classified') {
            $alert->status = 'open';
        }

        $alert->save();

        return $alert->fresh();
    }

    private function matchesPattern(string $eventKey, string $pattern): bool
    {
        foreach (explode('|', $pattern) as $part) {
            $part = trim($part);
            if ($part === '') {
                continue;
            }
            if (str_contains($part, '%')) {
                $regex = '/^'.str_replace('%', '.*', preg_quote($part, '/')).'$/i';
                if (preg_match($regex, $eventKey)) {
                    return true;
                }
            } elseif (strcasecmp($part, $eventKey) === 0) {
                return true;
            }
        }

        return false;
    }

    private function applyPatternFilter($query, string $pattern): void
    {
        $parts = array_values(array_filter(array_map('trim', explode('|', $pattern))));
        $likeOp = \Illuminate\Support\Facades\Schema::getConnection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
        $query->where(function ($q) use ($parts, $likeOp) {
            foreach ($parts as $i => $part) {
                $method = $i === 0 ? 'where' : 'orWhere';
                if (str_contains($part, '%')) {
                    $q->{$method}('event_key', $likeOp, $part);
                } else {
                    $q->{$method}('event_key', $part);
                }
            }
        });
    }
}
