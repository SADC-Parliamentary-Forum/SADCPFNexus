<?php

namespace App\Modules\PlatformAudit\Services;

use App\Models\PlatformAudit\AuditEvent;
use App\Models\PlatformAudit\AuditEventCheckpoint;
use App\Models\PlatformAudit\AuditEventDeadLetter;
use App\Models\PlatformAudit\AuditEventOutbox;
use App\Models\User;

class AuditReconciliationService
{
    /**
     * Detects missing/out-of-sequence audit evidence without fabricating replacement events.
     *
     * @return array<string, mixed>
     */
    public function reconcile(int $tenantId, ?User $actor = null, int $staleMinutes = 15): array
    {
        $sequence = $this->sequenceReport($tenantId);
        $latestCheckpoint = AuditEventCheckpoint::query()
            ->where('tenant_id', $tenantId)
            ->orderByDesc('to_sequence')
            ->orderByDesc('id')
            ->first();
        $latestSequence = (int) (AuditEvent::query()->where('tenant_id', $tenantId)->max('sequence_number') ?? 0);
        $processableOutbox = AuditEventOutbox::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('status', ['pending', 'failed'])
            ->where('attempts', '<', 3)
            ->where(function ($q) {
                $q->whereNull('available_at')->orWhere('available_at', '<=', now());
            })
            ->count();
        $pendingOutbox = AuditEventOutbox::query()
            ->where('tenant_id', $tenantId)
            ->where('status', 'pending')
            ->count();
        $failedOutbox = AuditEventOutbox::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('status', ['failed', 'dead_lettered'])
            ->count();
        $staleOutbox = AuditEventOutbox::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('status', ['pending', 'failed'])
            ->where('created_at', '<=', now()->subMinutes($staleMinutes))
            ->count();
        $openDeadLetters = AuditEventDeadLetter::query()
            ->where('tenant_id', $tenantId)
            ->where('status', 'open')
            ->count();

        $issues = [];
        if ($sequence['gap_count'] > 0) {
            $issues[] = [
                'type' => 'sequence_gap',
                'severity' => 'critical',
                'message' => 'Audit event sequence gaps were detected.',
                'details' => $sequence['gaps'],
            ];
        }
        if ($sequence['duplicate_sequence_count'] > 0) {
            $issues[] = [
                'type' => 'duplicate_sequence',
                'severity' => 'critical',
                'message' => 'Duplicate audit event sequence numbers were detected.',
                'details' => $sequence['duplicates'],
            ];
        }
        if ($openDeadLetters > 0) {
            $issues[] = [
                'type' => 'open_dead_letters',
                'severity' => 'high',
                'message' => 'Audit events are in the dead-letter queue and require controlled resolution.',
                'count' => $openDeadLetters,
            ];
        }
        if ($processableOutbox > 0) {
            $issues[] = [
                'type' => 'processable_outbox',
                'severity' => 'medium',
                'message' => 'Audit outbox rows are ready for processing and have not yet been committed.',
                'count' => $processableOutbox,
            ];
        }
        if ($failedOutbox > 0) {
            $issues[] = [
                'type' => 'failed_outbox',
                'severity' => 'high',
                'message' => 'Audit outbox rows have failed or were dead-lettered.',
                'count' => $failedOutbox,
            ];
        }
        if ($staleOutbox > 0) {
            $issues[] = [
                'type' => 'stale_outbox',
                'severity' => 'medium',
                'message' => 'Audit outbox rows are older than the reconciliation threshold.',
                'count' => $staleOutbox,
                'stale_minutes' => $staleMinutes,
            ];
        }
        if ($latestSequence > 0 && (! $latestCheckpoint || (int) $latestCheckpoint->to_sequence < $latestSequence)) {
            $issues[] = [
                'type' => $latestCheckpoint ? 'checkpoint_behind' : 'checkpoint_missing',
                'severity' => 'medium',
                'message' => 'The latest integrity checkpoint does not cover the full event chain.',
                'latest_sequence' => $latestSequence,
                'checkpoint_to_sequence' => $latestCheckpoint ? (int) $latestCheckpoint->to_sequence : null,
            ];
        }

        $result = [
            'status' => empty($issues) ? 'clean' : 'exceptions_found',
            'checked_at' => now()->toIso8601String(),
            'tenant_id' => $tenantId,
            'summary' => [
                'events_total' => AuditEvent::query()->where('tenant_id', $tenantId)->count(),
                'latest_sequence' => $latestSequence,
                'sequence_gap_count' => $sequence['gap_count'],
                'duplicate_sequence_count' => $sequence['duplicate_sequence_count'],
                'pending_outbox' => $pendingOutbox,
                'processable_outbox' => $processableOutbox,
                'failed_outbox' => $failedOutbox,
                'stale_outbox' => $staleOutbox,
                'open_dead_letters' => $openDeadLetters,
                'latest_checkpoint_id' => $latestCheckpoint?->id,
                'latest_checkpoint_to_sequence' => $latestCheckpoint ? (int) $latestCheckpoint->to_sequence : null,
            ],
            'issues' => $issues,
        ];

        $event = app(AuditEventIngestionService::class)->ingest([
            'tenant_id' => $tenantId,
            'event_key' => 'audit.reconciliation.completed',
            'actor_id' => $actor?->id,
            'actor_type' => $actor ? 'human' : 'service',
            'outcome' => empty($issues) ? 'success' : 'partially_completed',
            'source_module' => 'platform-audit',
            'subject_type' => 'PlatformAuditReconciliation',
            'action' => 'reconcile_audit_controls',
            'new_values' => $result,
        ]);

        $result['audit_event_id'] = $event->id;

        return $result;
    }

    /**
     * @return array{gap_count:int,duplicate_sequence_count:int,gaps:list<array<string,int>>,duplicates:list<array<string,int>>}
     */
    private function sequenceReport(int $tenantId): array
    {
        $gaps = [];
        $gapCount = 0;
        $previous = null;

        AuditEvent::query()
            ->where('tenant_id', $tenantId)
            ->orderBy('sequence_number')
            ->pluck('sequence_number')
            ->each(function ($sequence) use (&$previous, &$gaps, &$gapCount) {
                $sequence = (int) $sequence;
                if ($previous === null) {
                    if ($sequence > 1) {
                        $gapCount++;
                        if (count($gaps) < 20) {
                            $gaps[] = ['from' => 1, 'to' => $sequence - 1];
                        }
                    }
                    $previous = $sequence;

                    return;
                }

                if ($sequence > $previous + 1) {
                    $gapCount++;
                    if (count($gaps) < 20) {
                        $gaps[] = ['from' => $previous + 1, 'to' => $sequence - 1];
                    }
                }
                $previous = $sequence;
            });

        $duplicates = AuditEvent::query()
            ->where('tenant_id', $tenantId)
            ->selectRaw('sequence_number, count(*) as count')
            ->groupBy('sequence_number')
            ->havingRaw('count(*) > 1')
            ->orderBy('sequence_number')
            ->limit(20)
            ->get()
            ->map(fn ($row) => [
                'sequence_number' => (int) $row->sequence_number,
                'count' => (int) $row->count,
            ])
            ->values()
            ->all();

        $duplicateCount = AuditEvent::query()
            ->fromSub(
                AuditEvent::query()
                    ->where('tenant_id', $tenantId)
                    ->selectRaw('sequence_number, count(*) as count')
                    ->groupBy('sequence_number')
                    ->havingRaw('count(*) > 1'),
                'duplicate_sequences'
            )
            ->count();

        return [
            'gap_count' => $gapCount,
            'duplicate_sequence_count' => $duplicateCount,
            'gaps' => $gaps,
            'duplicates' => $duplicates,
        ];
    }
}
