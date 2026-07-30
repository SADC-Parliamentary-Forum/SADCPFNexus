<?php

namespace App\Modules\Documents\Services;

use App\Models\Documents\DocumentGovernanceDecision;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Document Repository PRD §125 — institutional governance checklist.
 * All items default to Pending; never invent institutional answers.
 */
class DocumentGovernanceService
{
    /**
     * @return list<array{key: string, title: string, description: string}>
     */
    public static function catalogue(): array
    {
        return [
            [
                'key' => 'approved_av_product',
                'title' => 'Approved malware / AV product',
                'description' => 'Which AV product (ClamAV, HTTP gateway, commercial) is institutionally approved.',
            ],
            [
                'key' => 'default_retention_schedules',
                'title' => 'Default retention schedules',
                'description' => 'Default retention periods by document type / module.',
            ],
            [
                'key' => 'disposal_authority',
                'title' => 'Disposal approval authority',
                'description' => 'Who may approve destruction after retain-until elapses.',
            ],
            [
                'key' => 'external_sharing_policy',
                'title' => 'External sharing policy',
                'description' => 'Whether time-limited external shares are permitted and for which classifications.',
            ],
            [
                'key' => 'confidentiality_labels',
                'title' => 'Confidentiality label set',
                'description' => 'Official confidentiality taxonomy for the repository.',
            ],
            [
                'key' => 'ocr_provider',
                'title' => 'OCR provider',
                'description' => 'Approved OCR driver (null stub until decided).',
            ],
            [
                'key' => 'archive_storage_class',
                'title' => 'Archive / cold storage class',
                'description' => 'When documents move from hot → warm → cold → archive storage.',
            ],
            [
                'key' => 'sharepoint_migration',
                'title' => 'SharePoint / OneDrive migration',
                'description' => 'Whether a migration from SharePoint/OneDrive will be executed and under which credentials.',
            ],
            [
                'key' => 'watermark_defaults',
                'title' => 'Watermark defaults',
                'description' => 'Default watermarking for external downloads.',
            ],
            [
                'key' => 'ai_assist_scope',
                'title' => 'AI assist scope',
                'description' => 'Which Phase 3 AI suggestions (metadata / summarise / redact) may be enabled — suggestions only, human confirm.',
            ],
            [
                'key' => 'physical_original_policy',
                'title' => 'Physical original tracking',
                'description' => 'Policy for barcode / physical-location tracking of paper originals.',
            ],
            [
                'key' => 'backup_recovery_rpo',
                'title' => 'Backup / recovery RPO',
                'description' => 'Repository backup and recovery objectives (ops-owned).',
            ],
        ];
    }

    public function ensureSeeded(Tenant|int $tenant): Collection
    {
        $tenantId = $tenant instanceof Tenant ? $tenant->id : $tenant;
        $rows = [];
        foreach (self::catalogue() as $i => $item) {
            $rows[] = DocumentGovernanceDecision::query()->firstOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'decision_key' => $item['key'],
                ],
                [
                    'sort_order' => $i + 1,
                    'title' => $item['title'],
                    'description' => $item['description'],
                    'status' => DocumentGovernanceDecision::STATUS_PENDING,
                ]
            );
        }

        return collect($rows)->sortBy('sort_order')->values();
    }

    public function listForTenant(int $tenantId): Collection
    {
        $this->ensureSeeded($tenantId);

        return DocumentGovernanceDecision::query()
            ->where('tenant_id', $tenantId)
            ->with('decidedByUser:id,name')
            ->orderBy('sort_order')
            ->get();
    }

    public function update(User $actor, DocumentGovernanceDecision $decision, array $data): DocumentGovernanceDecision
    {
        if ((int) $decision->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        $status = $data['status'];
        if (! in_array($status, [
            DocumentGovernanceDecision::STATUS_PENDING,
            DocumentGovernanceDecision::STATUS_DECIDED,
            DocumentGovernanceDecision::STATUS_NOT_APPLICABLE,
        ], true)) {
            throw ValidationException::withMessages(['status' => ['Invalid status.']]);
        }

        $decision->update([
            'status' => $status,
            'decision_notes' => $data['decision_notes'] ?? $decision->decision_notes,
            'decided_by' => $status === DocumentGovernanceDecision::STATUS_PENDING ? null : $actor->id,
            'decided_at' => $status === DocumentGovernanceDecision::STATUS_PENDING ? null : now(),
        ]);

        return $decision->fresh('decidedByUser:id,name');
    }
}
