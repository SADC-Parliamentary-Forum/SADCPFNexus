<?php

namespace App\Modules\PlatformAudit\Services;

use App\Models\PlatformAudit\AuditTrailGovernanceDecision;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * PRD §122 — institutional governance checklist. Defaults Pending; never invent answers.
 */
class AuditTrailGovernanceService
{
    /**
     * @return list<array{key: string, title: string, description: string}>
     */
    public static function catalogue(): array
    {
        return [
            ['key' => 'event_retention_periods', 'title' => 'Event-retention periods by category', 'description' => 'Retention periods by audit event category (do not invent durations).'],
            ['key' => 'confidentiality_model', 'title' => 'Audit-log confidentiality model', 'description' => 'How confidentiality labels are applied to audit events.'],
            ['key' => 'user_activity_search_authority', 'title' => 'Who may search user activity', 'description' => 'Roles authorised to search user activity histories.'],
            ['key' => 'auditor_access_scope', 'title' => 'Internal and External Auditor access scope', 'description' => 'Access scope for Internal and External Auditors.'],
            ['key' => 'security_monitoring_responsibility', 'title' => 'Security-monitoring responsibilities', 'description' => 'Who owns security monitoring response (Phase 2).'],
            ['key' => 'forensic_case_approval', 'title' => 'Forensic-case approval authority', 'description' => 'Who may open/approve forensic cases (Phase 2).'],
            ['key' => 'break_glass_authority', 'title' => 'Break-glass access authority', 'description' => 'Break-glass access approval authority.'],
            ['key' => 'integrity_architecture', 'title' => 'Approved integrity architecture', 'description' => 'Approved hash/checkpoint architecture.'],
            ['key' => 'signing_key_custody', 'title' => 'Hash/checkpoint signing-key custody', 'description' => 'Custody of signing keys (never store private keys in audit tables).'],
            ['key' => 'immutable_archive_platform', 'title' => 'Immutable archive platform', 'description' => 'Off-platform WORM/immutable archive choice (Phase 2).'],
            ['key' => 'siem_integration', 'title' => 'SIEM integration', 'description' => 'Whether/any SIEM integration is approved (Phase 2).'],
            ['key' => 'ip_device_retention', 'title' => 'IP/device-data retention', 'description' => 'Retention for IP and device context fields.'],
            ['key' => 'employee_privacy_notice', 'title' => 'Employee privacy notice', 'description' => 'Privacy notice covering audit trail processing.'],
            ['key' => 'view_download_logging', 'title' => 'Which record views and downloads require logging', 'description' => 'Policy for view vs download logging.'],
            ['key' => 'export_justification', 'title' => 'Which exports require justification and approval', 'description' => 'Export justification/approval rules.'],
            ['key' => 'legacy_event_classification', 'title' => 'How old legacy audit events will be classified', 'description' => 'Classification of migrated AuditLog rows.'],
            ['key' => 'user_activity_report_approval', 'title' => 'Whether user activity reports require HR or SG approval', 'description' => 'Approval gate for user activity reports.'],
            ['key' => 'event_disposal_authority', 'title' => 'Event-disposal approval authority', 'description' => 'Who may approve disposal after retention (holds override).'],
            ['key' => 'incident_escalation_thresholds', 'title' => 'Incident-escalation thresholds', 'description' => 'Escalation thresholds for security indicators (Phase 2).'],
            ['key' => 'event_taxonomy_owners', 'title' => 'Approved event taxonomy owners', 'description' => 'Owners of the controlled event type registry.'],
        ];
    }

    public function ensureSeeded(Tenant|int $tenant): Collection
    {
        $tenantId = $tenant instanceof Tenant ? $tenant->id : $tenant;
        $rows = [];
        foreach (self::catalogue() as $i => $item) {
            $rows[] = AuditTrailGovernanceDecision::query()->firstOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'decision_key' => $item['key'],
                ],
                [
                    'sort_order' => $i + 1,
                    'title' => $item['title'],
                    'description' => $item['description'],
                    'status' => AuditTrailGovernanceDecision::STATUS_PENDING,
                ]
            );
        }

        return collect($rows)->sortBy('sort_order')->values();
    }

    public function listForTenant(Tenant|int $tenant): Collection
    {
        return $this->ensureSeeded($tenant);
    }

    /**
     * @param  array{status: string, decision_notes?: ?string}  $data
     */
    public function update(AuditTrailGovernanceDecision $decision, array $data, User $actor): AuditTrailGovernanceDecision
    {
        $status = $data['status'];
        if (! in_array($status, [
            AuditTrailGovernanceDecision::STATUS_PENDING,
            AuditTrailGovernanceDecision::STATUS_DECIDED,
            AuditTrailGovernanceDecision::STATUS_NA,
        ], true)) {
            throw ValidationException::withMessages(['status' => 'Invalid status.']);
        }

        return DB::transaction(function () use ($decision, $data, $actor, $status) {
            $old = $decision->only(['status', 'decision_notes', 'decided_by', 'decided_at']);

            $decision->status = $status;
            $decision->decision_notes = $data['decision_notes'] ?? $decision->decision_notes;
            if ($status === AuditTrailGovernanceDecision::STATUS_DECIDED || $status === AuditTrailGovernanceDecision::STATUS_NA) {
                $decision->decided_by = $actor->id;
                $decision->decided_at = now();
            } else {
                $decision->decided_by = null;
                $decision->decided_at = null;
            }
            $decision->save();

            app(AuditEventIngestionService::class)->ingest([
                'tenant_id' => $decision->tenant_id,
                'event_key' => 'audit.governance.updated',
                'actor_id' => $actor->id,
                'actor_type' => 'human',
                'outcome' => 'success',
                'source_module' => 'platform-audit',
                'subject_type' => AuditTrailGovernanceDecision::class,
                'subject_id' => $decision->id,
                'business_reference' => $decision->decision_key,
                'old_values' => $old,
                'new_values' => $decision->only(['status', 'decision_notes', 'decided_by', 'decided_at']),
            ]);

            return $decision->fresh();
        });
    }
}
