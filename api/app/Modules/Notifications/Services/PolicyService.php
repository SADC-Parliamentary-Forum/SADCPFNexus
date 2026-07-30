<?php

namespace App\Modules\Notifications\Services;

use App\Models\Notifications\NotificationPolicy;
use App\Models\Notifications\NotificationPreference;
use App\Models\Notifications\NotificationSuppression;
use App\Models\User;
use Carbon\Carbon;

class PolicyService
{
    public const MANDATORY_CATEGORIES = [
        'workflow',
        'security',
        'compliance',
        'mandatory_transactional',
    ];

    public const MANDATORY_EVENT_PREFIXES = [
        'workflow.',
        'user.security_',
        'user.mfa_',
        'user.sessions_',
        'programme.approved',
        'assignment.issued',
    ];

    public function resolvePolicy(int $tenantId, string $eventKey): array
    {
        $stored = NotificationPolicy::query()
            ->where('tenant_id', $tenantId)
            ->where('event_key', $eventKey)
            ->where('status', 'published')
            ->orderByDesc('version')
            ->first();

        if ($stored) {
            return $stored->toArray();
        }

        return $this->defaultPolicy($eventKey);
    }

    public function defaultPolicy(string $eventKey): array
    {
        $mandatory = $this->isMandatoryEvent($eventKey);
        $category = $this->inferCategory($eventKey);
        $actionRequired = str_contains($eventKey, 'approval_required')
            || str_contains($eventKey, 'action')
            || str_ends_with($eventKey, '.issued')
            || str_contains($eventKey, 'submitted');

        $digestEligible = ! $mandatory && in_array($category, ['operational', 'digest'], true);

        return [
            'event_key' => $eventKey,
            'version' => 1,
            'status' => 'published',
            'category' => $category,
            'delivery_class' => $mandatory ? 'mandatory_transactional' : ($digestEligible ? 'digest_eligible' : 'operational'),
            'importance' => $mandatory ? 'high' : 'normal',
            'confidentiality' => $this->inferConfidentiality($eventKey),
            'mandatory' => $mandatory,
            'digest_eligible' => $digestEligible,
            'action_required' => $actionRequired,
            'in_app_enabled' => true,
            'email_enabled' => true,
            // Phase 2: push is a first-class policy channel (provider may still be Null stub).
            'push_enabled' => $mandatory || $actionRequired || str_starts_with($eventKey, 'notifications.'),
            'sms_enabled' => false, // Governance Configuration Pending
            'whatsapp_enabled' => false, // Governance Configuration Pending
            'template_key' => $eventKey,
            'queue_priority' => $mandatory ? 'critical' : ($digestEligible ? 'digest' : 'normal'),
            'channels' => array_values(array_filter([
                'in_app',
                'email',
                ($mandatory || $actionRequired || str_starts_with($eventKey, 'notifications.')) ? 'push' : null,
            ])),
            'coalesce_eligible' => $digestEligible,
            'retry_profile' => ['max_attempts' => 5, 'backoff_seconds' => [60, 300, 900, 3600, 14400]],
            'reminder_policy' => null,
            'escalation_policy' => null,
        ];
    }

    public function isMandatoryEvent(string $eventKey): bool
    {
        foreach (self::MANDATORY_EVENT_PREFIXES as $prefix) {
            if (str_starts_with($eventKey, $prefix)) {
                return true;
            }
        }

        return in_array($this->inferCategory($eventKey), self::MANDATORY_CATEGORIES, true);
    }

    public function inferCategory(string $eventKey): string
    {
        $module = explode('.', $eventKey)[0] ?? 'general';

        return match ($module) {
            'workflow', 'programme', 'assignment' => 'workflow',
            'user' => str_contains($eventKey, 'security') || str_contains($eventKey, 'mfa') || str_contains($eventKey, 'sessions')
                ? 'security'
                : 'operational',
            'audit', 'risk' => 'compliance',
            'alerts', 'weekly_report' => 'digest',
            default => 'operational',
        };
    }

    public function inferConfidentiality(string $eventKey): string
    {
        if (str_starts_with($eventKey, 'audit.') || str_starts_with($eventKey, 'risk.')) {
            return 'confidential';
        }
        if (str_starts_with($eventKey, 'user.') || str_starts_with($eventKey, 'finance.') || str_starts_with($eventKey, 'salary_')) {
            return 'restricted';
        }

        return 'internal';
    }

    /**
     * Preferences cannot disable mandatory notices.
     *
     * @return array{in_app: bool, email: bool, push: bool, digest: bool, quiet_hours_defer: bool, language: string}
     */
    public function channelDecisions(User $user, array $policy): array
    {
        $category = $policy['category'] ?? 'operational';
        $mandatory = (bool) ($policy['mandatory'] ?? false);

        $pref = NotificationPreference::query()
            ->where('user_id', $user->id)
            ->where('category', $category)
            ->first();

        $inApp = (bool) ($policy['in_app_enabled'] ?? true);
        $email = (bool) ($policy['email_enabled'] ?? true);
        $push = (bool) ($policy['push_enabled'] ?? false);
        $digest = (bool) ($policy['digest_eligible'] ?? false);

        if ($pref && ! $mandatory) {
            $inApp = $inApp && $pref->in_app_enabled;
            $email = $email && $pref->email_enabled;
            $push = $push && $pref->push_enabled;
            if ($pref->digest_mode === 'off') {
                $digest = false;
            } elseif (in_array($pref->digest_mode, ['daily', 'weekly'], true)) {
                $digest = true;
                $email = false; // defer email into digest for optional
            }
        }

        // Mandatory always keeps in-app + email.
        if ($mandatory) {
            $inApp = true;
            $email = true;
            $digest = false;
        }

        $quietDefer = false;
        if ($pref && ! $mandatory && $pref->quiet_hours_start && $pref->quiet_hours_end) {
            $quietDefer = $this->inQuietHours(now(), $pref->quiet_hours_start, $pref->quiet_hours_end);
        }

        if ($this->isSuppressed($user, 'email')) {
            $email = false;
        }

        return [
            'in_app' => $inApp,
            'email' => $email,
            'push' => $push,
            'digest' => $digest && ! $mandatory,
            'quiet_hours_defer' => $quietDefer,
            'language' => $pref?->preferred_language ?: ($user->preferred_language ?? 'en'),
        ];
    }

    public function inQuietHours(Carbon $now, string $start, string $end): bool
    {
        $current = $now->format('H:i:s');
        if ($start <= $end) {
            return $current >= $start && $current <= $end;
        }

        // Overnight window
        return $current >= $start || $current <= $end;
    }

    public function isSuppressed(User $user, string $channel): bool
    {
        return NotificationSuppression::query()
            ->where('tenant_id', $user->tenant_id)
            ->where(function ($q) use ($user, $channel) {
                $q->where(function ($inner) use ($user) {
                    $inner->where('user_id', $user->id);
                })->orWhere(function ($inner) use ($user, $channel) {
                    $inner->where('channel', $channel)
                        ->where('destination', $user->email);
                });
            })
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->exists();
    }
}
