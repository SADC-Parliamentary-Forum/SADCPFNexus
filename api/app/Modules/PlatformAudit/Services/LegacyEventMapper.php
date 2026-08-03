<?php

namespace App\Modules\PlatformAudit\Services;

/**
 * Maps legacy AuditLog::record() event names to controlled registry keys.
 */
class LegacyEventMapper
{
    /** @var array<string, string> */
    private array $exact = [
        'auth.login' => 'auth.login.succeeded',
        'auth.login_succeeded' => 'auth.login.succeeded',
        'auth.login.failed' => 'auth.login.failed',
        'auth.logout' => 'auth.logout',
        'auth.mfa.disabled' => 'auth.mfa.disabled',
        'auth.password.changed' => 'auth.password.changed',
        'auth.password.reset' => 'auth.password.reset',
        'document.uploaded' => 'document.version.uploaded',
        'document.finalized' => 'document.version.finalized',
        'document.downloaded' => 'document.downloaded',
        'document.legal_hold_placed' => 'document.legal_hold.placed',
        'document.legal_hold_released' => 'document.legal_hold.released',
        'document.purged' => 'document.purged',
        'programme.created' => 'pif.record.created',
        'programme.updated' => 'pif.record.updated',
        'programme.submitted' => 'pif.record.submitted',
        'programme.approved' => 'pif.record.approved',
        'programme.rejected' => 'pif.record.denied',
        'programme.denied' => 'pif.record.denied',
        'leave.created' => 'leave.request.created',
        'leave.updated' => 'leave.request.updated',
        'leave.submitted' => 'leave.request.submitted',
        'leave.approved' => 'leave.request.approved',
        'leave.rejected' => 'leave.request.rejected',
        'system.export.generated' => 'system.export.generated',
    ];

    /**
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    public function map(string $legacyEvent, array $context = []): array
    {
        $eventKey = $this->mapKey($legacyEvent);
        $category = $this->categoryFor($eventKey, $legacyEvent, $context);

        $outcome = 'success';
        if (str_contains($legacyEvent, 'failed') || str_contains($legacyEvent, 'denied')) {
            $outcome = str_contains($legacyEvent, 'denied') ? 'denied' : 'failed';
        } elseif (str_contains($legacyEvent, 'rejected')) {
            $outcome = 'failed';
        }

        return [
            'event_key' => $eventKey,
            'event_type' => $eventKey,
            'category' => $category,
            'outcome' => $outcome,
            'source_module' => is_string($context['tags'] ?? null)
                ? $context['tags']
                : (is_array($context['tags'] ?? null) ? ($context['tags'][0] ?? null) : $this->moduleFromKey($eventKey)),
            'action' => $legacyEvent,
            'subject_type' => $context['auditable_type'] ?? null,
            'subject_id' => $context['auditable_id'] ?? null,
            'auditable_type' => $context['auditable_type'] ?? null,
            'auditable_id' => $context['auditable_id'] ?? null,
            'old_values' => $context['old_values'] ?? null,
            'new_values' => $context['new_values'] ?? null,
            'tenant_id' => $context['tenant_id'] ?? auth()->user()?->tenant_id,
            'actor_id' => $context['user_id'] ?? auth()->id(),
            'actor_type' => ($context['user_id'] ?? auth()->id()) ? 'human' : 'anonymous',
            'schema_version' => 1,
            'producer_version' => 'legacy-auditlog-adapter@1',
        ];
    }

    public function mapKey(string $legacyEvent): string
    {
        if (isset($this->exact[$legacyEvent])) {
            return $this->exact[$legacyEvent];
        }

        if (str_starts_with($legacyEvent, 'programme.')) {
            $action = substr($legacyEvent, strlen('programme.'));

            return match (true) {
                str_contains($action, 'approv') => 'pif.record.approved',
                str_contains($action, 'reject') || str_contains($action, 'den') => 'pif.record.denied',
                str_contains($action, 'submit') => 'pif.record.submitted',
                str_contains($action, 'creat') => 'pif.record.created',
                str_contains($action, 'updat') => 'pif.record.updated',
                str_contains($action, 'export') || str_contains($action, 'pdf') => 'pif.record.exported',
                default => 'pif.record.updated',
            };
        }

        if (str_starts_with($legacyEvent, 'leave.')) {
            return match (true) {
                str_contains($legacyEvent, 'approv') => 'leave.request.approved',
                str_contains($legacyEvent, 'reject') => 'leave.request.rejected',
                str_contains($legacyEvent, 'submit') => 'leave.request.submitted',
                str_contains($legacyEvent, 'creat') => 'leave.request.created',
                default => 'leave.request.updated',
            };
        }

        if (str_starts_with($legacyEvent, 'auth.')) {
            return match (true) {
                str_contains($legacyEvent, 'fail') => 'auth.login.failed',
                str_contains($legacyEvent, 'logout') => 'auth.logout',
                str_contains($legacyEvent, 'mfa') && str_contains($legacyEvent, 'disable') => 'auth.mfa.disabled',
                str_contains($legacyEvent, 'password') => 'auth.password.changed',
                default => 'auth.login.succeeded',
            };
        }

        if (str_starts_with($legacyEvent, 'workflow.') || str_contains($legacyEvent, 'approval')) {
            return match (true) {
                str_contains($legacyEvent, 'reject') => 'workflow.decision.rejected',
                str_contains($legacyEvent, 'approv') => 'workflow.decision.approved',
                str_contains($legacyEvent, 'submit') => 'workflow.request.submitted',
                default => 'workflow.request.submitted',
            };
        }

        if (str_starts_with($legacyEvent, 'role.') || str_starts_with($legacyEvent, 'user.role')) {
            return str_contains($legacyEvent, 'revok') || str_contains($legacyEvent, 'remov')
                ? 'identity.role.revoked'
                : 'identity.role.assigned';
        }

        if (str_starts_with($legacyEvent, 'document.')) {
            return match (true) {
                str_contains($legacyEvent, 'download') => 'document.downloaded',
                str_contains($legacyEvent, 'upload') => 'document.version.uploaded',
                str_contains($legacyEvent, 'final') => 'document.version.finalized',
                str_contains($legacyEvent, 'purge') => 'document.purged',
                default => 'document.version.uploaded',
            };
        }

        if (str_starts_with($legacyEvent, 'travel.')) {
            return match (true) {
                str_contains($legacyEvent, 'approv') => 'travel.request.approved',
                str_contains($legacyEvent, 'reject') || str_contains($legacyEvent, 'den') => 'travel.request.denied',
                str_contains($legacyEvent, 'submit') => 'travel.request.submitted',
                default => 'travel.request.created',
            };
        }

        // Preserve only keys that are part of the governed registry catalogue.
        // Unknown legacy names remain available in action/legacy_meta but do not
        // create new event types during migration.
        if (isset(EventTypeRegistryService::catalogueKeyMap()[$legacyEvent])) {
            return $legacyEvent;
        }

        return 'other.controlled';
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function categoryFor(string $eventKey, string $legacyEvent, array $context): string
    {
        if (is_string($context['tags'] ?? null)) {
            $tag = strtolower($context['tags']);
            if (str_contains($tag, 'programme') || $tag === 'pif') {
                return 'PIF';
            }
            if ($tag === 'leave') {
                return 'Leave';
            }
        }

        $prefix = explode('.', $eventKey)[0] ?? 'other';

        return match ($prefix) {
            'auth' => 'Authentication',
            'identity' => 'Role and Permission',
            'workflow' => 'Workflow',
            'document' => 'Document',
            'pif' => 'PIF',
            'leave' => 'Leave',
            'travel' => 'Travel',
            'procurement' => 'Procurement',
            'budget' => 'Budget',
            'finance' => 'Finance',
            'security' => 'Security',
            'system' => 'Configuration',
            default => str_starts_with($legacyEvent, 'programme.') ? 'PIF' : 'Other controlled category',
        };
    }

    private function moduleFromKey(string $eventKey): string
    {
        return explode('.', $eventKey)[0] ?? 'system';
    }
}
