<?php

namespace App\Modules\PlatformAudit\Services;

use App\Models\PlatformAudit\AuditEventSchemaVersion;
use App\Models\PlatformAudit\AuditEventType;
use Illuminate\Support\Facades\DB;

/**
 * PRD §8 / §11 / §12 — controlled event taxonomy.
 */
class EventTypeRegistryService
{
    /**
     * @return list<array{event_key:string,name:string,category:string,severity:string,description?:string}>
     */
    public static function catalogue(): array
    {
        return [
            // Authentication
            ['event_key' => 'auth.login.succeeded', 'name' => 'Login succeeded', 'category' => 'Authentication', 'severity' => 'informational'],
            ['event_key' => 'auth.login.failed', 'name' => 'Login failed', 'category' => 'Authentication', 'severity' => 'medium'],
            ['event_key' => 'auth.logout', 'name' => 'Logout', 'category' => 'Authentication', 'severity' => 'informational'],
            ['event_key' => 'auth.mfa.challenged', 'name' => 'MFA challenged', 'category' => 'Authentication', 'severity' => 'informational'],
            ['event_key' => 'auth.mfa.succeeded', 'name' => 'MFA succeeded', 'category' => 'Authentication', 'severity' => 'informational'],
            ['event_key' => 'auth.mfa.failed', 'name' => 'MFA failed', 'category' => 'Authentication', 'severity' => 'medium'],
            ['event_key' => 'auth.mfa.disabled', 'name' => 'MFA disabled', 'category' => 'Authentication', 'severity' => 'high'],
            ['event_key' => 'auth.password.changed', 'name' => 'Password changed', 'category' => 'Authentication', 'severity' => 'medium'],
            ['event_key' => 'auth.password.reset', 'name' => 'Password reset', 'category' => 'Authentication', 'severity' => 'medium'],
            ['event_key' => 'auth.session.revoked', 'name' => 'Session revoked', 'category' => 'Authentication', 'severity' => 'medium'],

            // Role / permission / authority
            ['event_key' => 'identity.role.assigned', 'name' => 'Role assigned', 'category' => 'Role and Permission', 'severity' => 'high'],
            ['event_key' => 'identity.role.revoked', 'name' => 'Role revoked', 'category' => 'Role and Permission', 'severity' => 'high'],
            ['event_key' => 'identity.permission.granted', 'name' => 'Permission granted', 'category' => 'Role and Permission', 'severity' => 'high'],
            ['event_key' => 'identity.permission.revoked', 'name' => 'Permission revoked', 'category' => 'Role and Permission', 'severity' => 'high'],
            ['event_key' => 'identity.authority.granted', 'name' => 'Authority granted', 'category' => 'Authority', 'severity' => 'high'],
            ['event_key' => 'identity.authority.revoked', 'name' => 'Authority revoked', 'category' => 'Authority', 'severity' => 'high'],
            ['event_key' => 'identity.delegation.created', 'name' => 'Delegation created', 'category' => 'Delegation', 'severity' => 'medium'],
            ['event_key' => 'identity.delegation.revoked', 'name' => 'Delegation revoked', 'category' => 'Delegation', 'severity' => 'medium'],
            ['event_key' => 'identity.acting.started', 'name' => 'Acting appointment started', 'category' => 'Acting Appointment', 'severity' => 'medium'],
            ['event_key' => 'identity.acting.ended', 'name' => 'Acting appointment ended', 'category' => 'Acting Appointment', 'severity' => 'medium'],

            // Workflow / approval
            ['event_key' => 'workflow.request.submitted', 'name' => 'Workflow submitted', 'category' => 'Workflow', 'severity' => 'informational'],
            ['event_key' => 'workflow.decision.approved', 'name' => 'Workflow approved', 'category' => 'Approval', 'severity' => 'medium'],
            ['event_key' => 'workflow.decision.rejected', 'name' => 'Workflow rejected', 'category' => 'Approval', 'severity' => 'medium'],
            ['event_key' => 'workflow.decision.returned', 'name' => 'Workflow returned', 'category' => 'Approval', 'severity' => 'informational'],
            ['event_key' => 'workflow.step.delegated', 'name' => 'Workflow step delegated', 'category' => 'Workflow', 'severity' => 'medium'],

            // Documents
            ['event_key' => 'document.version.uploaded', 'name' => 'Document uploaded', 'category' => 'Document', 'severity' => 'informational'],
            ['event_key' => 'document.version.finalized', 'name' => 'Document finalized', 'category' => 'Document', 'severity' => 'medium'],
            ['event_key' => 'document.previewed', 'name' => 'Document previewed', 'category' => 'Document', 'severity' => 'informational'],
            ['event_key' => 'document.downloaded', 'name' => 'Document downloaded', 'category' => 'Document', 'severity' => 'medium'],
            ['event_key' => 'document.shared', 'name' => 'Document shared', 'category' => 'Document', 'severity' => 'medium'],
            ['event_key' => 'document.legal_hold.placed', 'name' => 'Document legal hold placed', 'category' => 'Document', 'severity' => 'high'],
            ['event_key' => 'document.legal_hold.released', 'name' => 'Document legal hold released', 'category' => 'Document', 'severity' => 'high'],
            ['event_key' => 'document.purged', 'name' => 'Document purged', 'category' => 'Retention and Disposal', 'severity' => 'critical'],

            // PIF / Leave / Travel / Finance domain patterns
            ['event_key' => 'pif.record.created', 'name' => 'PIF created', 'category' => 'PIF', 'severity' => 'informational'],
            ['event_key' => 'pif.record.updated', 'name' => 'PIF updated', 'category' => 'PIF', 'severity' => 'informational'],
            ['event_key' => 'pif.record.submitted', 'name' => 'PIF submitted', 'category' => 'PIF', 'severity' => 'medium'],
            ['event_key' => 'pif.record.approved', 'name' => 'PIF approved', 'category' => 'PIF', 'severity' => 'medium'],
            ['event_key' => 'pif.record.denied', 'name' => 'PIF denied', 'category' => 'PIF', 'severity' => 'medium'],
            ['event_key' => 'pif.record.exported', 'name' => 'PIF exported', 'category' => 'Report and Export', 'severity' => 'medium'],

            ['event_key' => 'leave.request.created', 'name' => 'Leave created', 'category' => 'Leave', 'severity' => 'informational'],
            ['event_key' => 'leave.request.updated', 'name' => 'Leave updated', 'category' => 'Leave', 'severity' => 'informational'],
            ['event_key' => 'leave.request.submitted', 'name' => 'Leave submitted', 'category' => 'Leave', 'severity' => 'informational'],
            ['event_key' => 'leave.request.approved', 'name' => 'Leave approved', 'category' => 'Leave', 'severity' => 'medium'],
            ['event_key' => 'leave.request.rejected', 'name' => 'Leave rejected', 'category' => 'Leave', 'severity' => 'medium'],

            ['event_key' => 'travel.request.created', 'name' => 'Travel created', 'category' => 'Travel', 'severity' => 'informational'],
            ['event_key' => 'travel.request.submitted', 'name' => 'Travel submitted', 'category' => 'Travel', 'severity' => 'informational'],
            ['event_key' => 'travel.request.approved', 'name' => 'Travel approved', 'category' => 'Travel', 'severity' => 'medium'],
            ['event_key' => 'travel.request.denied', 'name' => 'Travel denied', 'category' => 'Travel', 'severity' => 'medium'],

            ['event_key' => 'procurement.request.created', 'name' => 'Procurement created', 'category' => 'Procurement', 'severity' => 'informational'],
            ['event_key' => 'procurement.award.approved', 'name' => 'Procurement award approved', 'category' => 'Procurement', 'severity' => 'high'],
            ['event_key' => 'budget.commitment.created', 'name' => 'Budget commitment created', 'category' => 'Budget', 'severity' => 'medium'],
            ['event_key' => 'finance.payment.approved', 'name' => 'Payment approved', 'category' => 'Finance', 'severity' => 'high'],
            ['event_key' => 'salary_advance.request.submitted', 'name' => 'Salary advance submitted', 'category' => 'Salary Advance', 'severity' => 'medium'],
            ['event_key' => 'payroll.run.approved', 'name' => 'Payroll run approved', 'category' => 'Payroll', 'severity' => 'high'],
            ['event_key' => 'timesheet.submitted', 'name' => 'Timesheet submitted', 'category' => 'Timesheet', 'severity' => 'informational'],
            ['event_key' => 'asset.record.updated', 'name' => 'Asset updated', 'category' => 'Asset', 'severity' => 'informational'],
            ['event_key' => 'stock.movement.posted', 'name' => 'Stock movement posted', 'category' => 'Stock', 'severity' => 'informational'],
            ['event_key' => 'risk.acceptance.approved', 'name' => 'Risk acceptance approved', 'category' => 'Risk', 'severity' => 'high'],
            ['event_key' => 'correspondence.registered', 'name' => 'Correspondence registered', 'category' => 'Correspondence', 'severity' => 'informational'],
            ['event_key' => 'assignment.issued', 'name' => 'Assignment issued', 'category' => 'Assignment', 'severity' => 'informational'],
            ['event_key' => 'weekly_summary.submitted', 'name' => 'Weekly summary submitted', 'category' => 'Weekly Summary', 'severity' => 'informational'],
            ['event_key' => 'mande.report.submitted', 'name' => 'M&E report submitted', 'category' => 'M&E', 'severity' => 'informational'],
            ['event_key' => 'notification.broadcast.sent', 'name' => 'Broadcast sent', 'category' => 'Notification', 'severity' => 'medium'],
            ['event_key' => 'system.export.generated', 'name' => 'Export generated', 'category' => 'Report and Export', 'severity' => 'medium'],
            ['event_key' => 'system.config.updated', 'name' => 'Configuration updated', 'category' => 'Configuration', 'severity' => 'high'],
            ['event_key' => 'system.admin.action', 'name' => 'Administrator action', 'category' => 'System Administration', 'severity' => 'high'],
            ['event_key' => 'security.access.denied', 'name' => 'Access denied', 'category' => 'Security', 'severity' => 'medium'],
            ['event_key' => 'security.integrity.failed', 'name' => 'Integrity failure', 'category' => 'Security', 'severity' => 'critical'],
            ['event_key' => 'migration.event.imported', 'name' => 'Legacy event migrated', 'category' => 'Migration', 'severity' => 'informational'],
            ['event_key' => 'audit.finding.closed', 'name' => 'Internal audit finding closed', 'category' => 'Internal Audit', 'severity' => 'medium'],
            ['event_key' => 'data.access.viewed', 'name' => 'Record viewed', 'category' => 'Data Access', 'severity' => 'informational'],
            ['event_key' => 'integration.event.received', 'name' => 'Integration event received', 'category' => 'Integration', 'severity' => 'informational'],
            ['event_key' => 'background.job.completed', 'name' => 'Background job completed', 'category' => 'Background Processing', 'severity' => 'informational'],
            ['event_key' => 'retention.hold.placed', 'name' => 'Event hold placed', 'category' => 'Retention and Disposal', 'severity' => 'high'],
            ['event_key' => 'retention.hold.released', 'name' => 'Event hold released', 'category' => 'Retention and Disposal', 'severity' => 'high'],
            ['event_key' => 'organisation.updated', 'name' => 'Organisation updated', 'category' => 'Organisation', 'severity' => 'informational'],
            ['event_key' => 'user.profile.updated', 'name' => 'User profile updated', 'category' => 'User Profile', 'severity' => 'informational'],
            ['event_key' => 'account.created', 'name' => 'Account created', 'category' => 'Account', 'severity' => 'medium'],
            ['event_key' => 'employment.updated', 'name' => 'Employment updated', 'category' => 'Employment', 'severity' => 'medium'],
            ['event_key' => 'supplier.updated', 'name' => 'Supplier updated', 'category' => 'Supplier', 'severity' => 'informational'],
            ['event_key' => 'exception.raised', 'name' => 'Exception raised', 'category' => 'Exception', 'severity' => 'medium'],
            ['event_key' => 'other.controlled', 'name' => 'Other controlled event', 'category' => 'Other controlled category', 'severity' => 'informational'],
        ];
    }

    public function ensureSeeded(): void
    {
        DB::transaction(function () {
            foreach (self::catalogue() as $item) {
                $type = AuditEventType::query()->firstOrCreate(
                    ['event_key' => $item['event_key']],
                    [
                        'name' => $item['name'],
                        'description' => $item['description'] ?? $item['name'],
                        'category' => $item['category'],
                        'severity' => $item['severity'],
                        'required_fields' => ['event_uuid', 'event_type', 'schema_version', 'timestamp', 'actor', 'outcome'],
                        'optional_fields' => ['subject', 'changes', 'reason', 'correlation_id'],
                        'sensitive_fields' => SensitiveFieldMasker::EXCLUDED_KEYS,
                        'actor_required' => true,
                        'subject_required' => false,
                        'retention_class' => 'standard',
                        'user_visible_label' => $item['name'],
                        'effective_version' => 1,
                        'status' => 'active',
                    ]
                );

                AuditEventSchemaVersion::query()->firstOrCreate(
                    [
                        'audit_event_type_id' => $type->id,
                        'schema_version' => 1,
                    ],
                    [
                        'producer_version' => 'platform-audit-trail@1',
                        'payload_schema' => ['version' => 1],
                        'change_notes' => 'Initial Phase 1 schema',
                        'effective_from' => now(),
                    ]
                );
            }
        });
    }

    public function findByKey(string $eventKey): ?AuditEventType
    {
        return AuditEventType::query()->where('event_key', $eventKey)->first();
    }

    public function resolveOrRegister(string $eventKey, ?string $category = null): AuditEventType
    {
        $existing = $this->findByKey($eventKey);
        if ($existing) {
            return $existing;
        }

        $inferredCategory = $category ?? $this->inferCategory($eventKey);

        return AuditEventType::query()->create([
            'event_key' => $eventKey,
            'name' => $eventKey,
            'description' => 'Auto-registered controlled key from producer',
            'category' => $inferredCategory,
            'severity' => 'informational',
            'required_fields' => ['event_uuid', 'event_type', 'timestamp', 'actor', 'outcome'],
            'sensitive_fields' => SensitiveFieldMasker::EXCLUDED_KEYS,
            'actor_required' => true,
            'subject_required' => false,
            'retention_class' => 'standard',
            'user_visible_label' => $eventKey,
            'effective_version' => 1,
            'status' => 'active',
        ]);
    }

    private function inferCategory(string $eventKey): string
    {
        $prefix = explode('.', $eventKey)[0] ?? 'other';

        return match ($prefix) {
            'auth' => 'Authentication',
            'identity', 'role', 'user' => 'Role and Permission',
            'workflow' => 'Workflow',
            'document' => 'Document',
            'programme', 'pif' => 'PIF',
            'leave' => 'Leave',
            'travel' => 'Travel',
            'procurement' => 'Procurement',
            'budget' => 'Budget',
            'finance' => 'Finance',
            'notification' => 'Notification',
            'risk' => 'Risk',
            'audit' => 'Internal Audit',
            'stock' => 'Stock',
            'assets', 'asset' => 'Asset',
            'correspondence' => 'Correspondence',
            'assignment' => 'Assignment',
            'timesheet', 'overtime' => 'Timesheet',
            'mande' => 'M&E',
            'system', 'setup', 'hr_settings' => 'Configuration',
            'migration' => 'Migration',
            default => 'Other controlled category',
        };
    }
}
