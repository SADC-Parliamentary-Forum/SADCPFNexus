<?php

namespace App\Modules\Decisions\Services;

use App\Models\MeetingDecision;
use App\Models\Risk;
use App\Models\User;
use App\Modules\Risk\Services\RiskService;
use Illuminate\Support\Facades\Log;

/**
 * Promote adopted/in-progress meeting decisions that look like risks into draft risk proposals.
 * Never closes the decision or auto-approves the risk.
 */
class DecisionRiskPromoteService
{
    public function __construct(private readonly RiskService $risks) {}

    public function promoteTenant(int $tenantId, ?int $minutesId = null): array
    {
        $actor = User::query()
            ->where('tenant_id', $tenantId)
            ->whereHas('roles', fn ($q) => $q->whereIn('name', ['System Admin', 'Governance Officer', 'Director']))
            ->orderBy('id')
            ->first()
            ?: User::query()->where('tenant_id', $tenantId)->orderBy('id')->first();

        if (! $actor) {
            return ['promoted' => 0, 'skipped' => 0, 'reason' => 'no_actor'];
        }

        $open = MeetingDecision::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('status', ['adopted', 'in_progress'])
            ->when($minutesId, fn ($q) => $q->where('meeting_minutes_id', $minutesId))
            ->get();

        $promoted = 0;
        $skipped = 0;

        foreach ($open as $decision) {
            $haystack = mb_strtolower(($decision->title ?? '').' '.($decision->body ?? '').' '.($decision->source_purpose ?? ''));
            if (! str_contains($haystack, 'risk')) {
                $skipped++;
                continue;
            }

            $existing = Risk::query()
                ->where('tenant_id', $tenantId)
                ->where('source_type', 'meeting_decision')
                ->where('source_id', $decision->id)
                ->where('source_purpose', 'meeting_risk_promote')
                ->first();
            if ($existing) {
                $skipped++;
                continue;
            }

            try {
                $this->risks->create([
                    'title' => $decision->title,
                    'description' => $decision->body ?: $decision->title,
                    'category' => 'operational',
                    'likelihood' => 3,
                    'impact' => 3,
                    'risk_owner_id' => $decision->owner_id ?: $actor->id,
                    'source_type' => 'meeting_decision',
                    'source_id' => $decision->id,
                    'source_purpose' => 'meeting_risk_promote',
                    'as_proposal' => true,
                    'event_description' => $decision->title,
                    'consequence' => $decision->body,
                ], $actor);
                $promoted++;
            } catch (\Throwable $e) {
                Log::warning('decision_risk_promote_failed', [
                    'decision_id' => $decision->id,
                    'error' => $e->getMessage(),
                ]);
                $skipped++;
            }
        }

        return ['promoted' => $promoted, 'skipped' => $skipped];
    }
}
