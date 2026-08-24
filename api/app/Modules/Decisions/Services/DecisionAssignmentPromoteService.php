<?php

namespace App\Modules\Decisions\Services;

use App\Models\Assignment;
use App\Models\MeetingDecision;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Weekly auto-promote of open adopted decisions into Assignments feed.
 * Idempotent via AssignmentService::createFromSource + last_promoted_at stamp.
 * Completing the assignment remains human-owned.
 */
class DecisionAssignmentPromoteService
{
    public function __construct(
        private readonly MeetingDecisionService $decisions,
    ) {}

    public function promoteTenant(int $tenantId, ?int $minutesId = null): array
    {
        $systemActor = User::query()
            ->where('tenant_id', $tenantId)
            ->whereHas('roles', fn ($q) => $q->whereIn('name', ['System Admin', 'Governance Officer', 'Director']))
            ->orderBy('id')
            ->first();

        if (! $systemActor) {
            $systemActor = User::query()->where('tenant_id', $tenantId)->orderBy('id')->first();
        }

        if (! $systemActor) {
            return ['promoted' => 0, 'skipped' => 0, 'reason' => 'no_actor'];
        }

        $open = MeetingDecision::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('status', ['adopted', 'in_progress'])
            ->whereNotNull('owner_id')
            ->whereNotNull('due_date')
            ->when($minutesId, fn ($q) => $q->where('meeting_minutes_id', $minutesId))
            ->get();

        $promoted = 0;
        $skipped = 0;

        foreach ($open as $decision) {
            try {
                $existing = Assignment::query()
                    ->where('tenant_id', $tenantId)
                    ->where('source_type', 'meeting_decision')
                    ->where('source_id', $decision->id)
                    ->where('source_purpose', 'weekly_promote')
                    ->first();

                if ($existing) {
                    if (! $decision->last_promoted_at) {
                        $decision->update(['last_promoted_at' => now()]);
                    }
                    $skipped++;
                    continue;
                }

                $this->decisions->createAssignmentForDecision($decision, $systemActor, [
                    'assigned_to' => $decision->owner_id,
                    'due_date' => $decision->due_date->toDateString(),
                    'source_purpose' => 'weekly_promote',
                    'title' => 'Decision: '.$decision->title,
                    'description' => $decision->body ?: ('Implement '.$decision->reference_number),
                    'preserve_status' => $minutesId !== null,
                ]);

                $decision->update(['last_promoted_at' => now()]);
                $promoted++;
            } catch (\Throwable $e) {
                Log::warning('decision_weekly_promote_failed', [
                    'decision_id' => $decision->id,
                    'error' => $e->getMessage(),
                ]);
                $skipped++;
            }
        }

        return ['promoted' => $promoted, 'skipped' => $skipped];
    }

    public function promoteAll(): array
    {
        $totals = ['promoted' => 0, 'skipped' => 0, 'tenants' => 0];
        Tenant::query()->each(function (Tenant $tenant) use (&$totals) {
            $result = $this->promoteTenant((int) $tenant->id);
            $totals['promoted'] += $result['promoted'];
            $totals['skipped'] += $result['skipped'];
            $totals['tenants']++;
        });

        return $totals;
    }
}
