<?php

namespace App\Modules\Notifications\Services;

use App\Models\Notifications\NotificationGovernanceDecision;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Notifications PRD §124 — institutional governance checklist.
 * Defaults all items to Pending; never invents institutional answers.
 */
class GovernanceChecklistService
{
    /**
     * @return list<array{key: string, title: string, description: string}>
     */
    public static function catalogue(): array
    {
        return [
            [
                'key' => 'official_email_provider',
                'title' => 'Official email provider/mailboxes',
                'description' => 'Official email-delivery provider and sending mailboxes.',
            ],
            [
                'key' => 'mandatory_categories',
                'title' => 'Mandatory categories',
                'description' => 'Which notification categories are mandatory.',
            ],
            [
                'key' => 'digest_eligible_categories',
                'title' => 'Digest-eligible categories',
                'description' => 'Which categories may be digested.',
            ],
            [
                'key' => 'quiet_hours_rules',
                'title' => 'Quiet-hours rules',
                'description' => 'Quiet-hours rules for non-critical notifications.',
            ],
            [
                'key' => 'critical_override_rules',
                'title' => 'Critical override rules',
                'description' => 'Critical-notification override rules.',
            ],
            [
                'key' => 'retention_periods',
                'title' => 'Retention periods',
                'description' => 'Email and delivery-log retention periods.',
            ],
            [
                'key' => 'circular_acknowledgements',
                'title' => 'Acknowledgements for circulars',
                'description' => 'Whether acknowledgements are required for institutional circulars.',
            ],
            [
                'key' => 'external_secure_tokens',
                'title' => 'External recipient secure tokens',
                'description' => 'Whether external recipients may receive secure token links.',
            ],
            [
                'key' => 'mobile_push_rollout',
                'title' => 'Mobile push rollout',
                'description' => 'Mobile push rollout approach.',
            ],
            [
                'key' => 'sms_whatsapp_approval',
                'title' => 'SMS/WhatsApp approval',
                'description' => 'Whether SMS or WhatsApp will ever be approved. Live HTTP drivers stay off until operator URL/token env is set.',
            ],
            [
                'key' => 'approved_broadcast_senders',
                'title' => 'Approved broadcast senders',
                'description' => 'Approved broadcast senders.',
            ],
            [
                'key' => 'template_approval_authority',
                'title' => 'Template approval authority',
                'description' => 'Template approval authority.',
            ],
            [
                'key' => 'delivery_service_targets',
                'title' => 'Delivery service targets',
                'description' => 'Acceptable delivery service targets / SLAs.',
            ],
            [
                'key' => 'bounce_escalation',
                'title' => 'Bounce escalation responsibility',
                'description' => 'Bounce and invalid-address escalation responsibility.',
            ],
            [
                'key' => 'email_open_tracking',
                'title' => 'Email open tracking policy',
                'description' => 'Whether email open tracking is prohibited or permitted.',
            ],
            [
                'key' => 'confidential_in_app_only',
                'title' => 'Confidential categories in-app only',
                'description' => 'Which confidential categories are in-app only.',
            ],
        ];
    }

    public function ensureSeeded(Tenant|int $tenant): Collection
    {
        $tenantId = $tenant instanceof Tenant ? $tenant->id : $tenant;
        $rows = [];
        foreach (self::catalogue() as $i => $item) {
            $rows[] = NotificationGovernanceDecision::query()->firstOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'decision_key' => $item['key'],
                ],
                [
                    'sort_order' => $i + 1,
                    'title' => $item['title'],
                    'description' => $item['description'],
                    'status' => NotificationGovernanceDecision::STATUS_PENDING,
                    'decision_notes' => null,
                    'decided_by' => null,
                    'decided_at' => null,
                ]
            );
        }

        return NotificationGovernanceDecision::query()
            ->where('tenant_id', $tenantId)
            ->orderBy('sort_order')
            ->get();
    }

    public function listForTenant(int $tenantId): Collection
    {
        return $this->ensureSeeded($tenantId);
    }

    /**
     * @param  array{status: string, decision_notes?: ?string}  $data
     */
    public function update(User $actor, NotificationGovernanceDecision $row, array $data): NotificationGovernanceDecision
    {
        if ((int) $row->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        $status = $data['status'];
        $allowed = [
            NotificationGovernanceDecision::STATUS_PENDING,
            NotificationGovernanceDecision::STATUS_DECIDED,
            NotificationGovernanceDecision::STATUS_NOT_APPLICABLE,
        ];
        if (! in_array($status, $allowed, true)) {
            throw ValidationException::withMessages(['status' => ['Invalid governance status.']]);
        }

        $notes = $data['decision_notes'] ?? $row->decision_notes;

        if ($status === NotificationGovernanceDecision::STATUS_PENDING) {
            $row->update([
                'status' => $status,
                'decision_notes' => $notes,
                'decided_by' => null,
                'decided_at' => null,
            ]);
        } else {
            $row->update([
                'status' => $status,
                'decision_notes' => $notes,
                'decided_by' => $actor->id,
                'decided_at' => now(),
            ]);
        }

        return $row->fresh(['decidedByUser:id,name']);
    }

    /**
     * SMS / WhatsApp channel status for admin UI — Null until HTTP credentials exist.
     *
     * @return array{sms: string, whatsapp: string}
     */
    public function channelGovernanceStatus(): array
    {
        $resolver = app(OutboundChannelResolver::class);

        return [
            'sms' => $resolver->sms()->status(),
            'whatsapp' => $resolver->whatsapp()->status(),
        ];
    }
}
