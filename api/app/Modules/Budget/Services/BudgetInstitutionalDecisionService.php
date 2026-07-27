<?php

namespace App\Modules\Budget\Services;

use App\Models\BudgetCycle;
use App\Models\BudgetCycleApproval;
use App\Models\BudgetCycleDecision;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BudgetInstitutionalDecisionService
{
    /** @var array<string, string> */
    private const BODY_REQUIRED_STATUS = [
        BudgetCycleDecision::BODY_FSC => BudgetCycle::STATUS_FSC_REVIEW,
        BudgetCycleDecision::BODY_EXCO => BudgetCycle::STATUS_EXCO_REVIEW,
        BudgetCycleDecision::BODY_PLENARY => BudgetCycle::STATUS_PLENARY_REVIEW,
    ];

    /** @var array<string, string> */
    private const BODY_NEXT_STATUS = [
        BudgetCycleDecision::BODY_FSC => BudgetCycle::STATUS_EXCO_REVIEW,
        BudgetCycleDecision::BODY_EXCO => BudgetCycle::STATUS_PLENARY_REVIEW,
        BudgetCycleDecision::BODY_PLENARY => BudgetCycle::STATUS_PLENARY_APPROVED,
    ];

    public function list(BudgetCycle $cycle)
    {
        return $cycle->decisions()
            ->with('recordedBy:id,name')
            ->orderByDesc('recorded_at')
            ->orderByDesc('id')
            ->get();
    }

    public function record(BudgetCycle $cycle, array $data, User $actor): BudgetCycleDecision
    {
        $this->assertRecorder($actor);
        $this->assertTenant($cycle, $actor);

        if ($cycle->isLocked()) {
            throw ValidationException::withMessages(['cycle' => 'Cycle is locked.']);
        }

        $body = $data['body'];
        $decision = $data['decision'];

        $requiredStatus = self::BODY_REQUIRED_STATUS[$body] ?? null;
        if (! $requiredStatus || $cycle->status !== $requiredStatus) {
            throw ValidationException::withMessages([
                'body' => "Decision for [{$body}] requires cycle status [{$requiredStatus}], currently [{$cycle->status}].",
            ]);
        }

        return DB::transaction(function () use ($cycle, $data, $actor, $body, $decision) {
            $row = BudgetCycleDecision::create([
                'budget_cycle_id' => $cycle->id,
                'body' => $body,
                'meeting_on' => $data['meeting_on'] ?? null,
                'decision' => $decision,
                'minute_reference' => $data['minute_reference'] ?? null,
                'comments' => $data['comments'] ?? null,
                'attachment_path' => $data['attachment_path'] ?? null,
                'recorded_by' => $actor->id,
                'recorded_at' => now(),
            ]);

            if ($decision === BudgetCycleDecision::DECISION_APPROVED) {
                $next = self::BODY_NEXT_STATUS[$body];
                $cycle->update(['status' => $next]);

                BudgetCycleApproval::create([
                    'budget_cycle_id' => $cycle->id,
                    'stage' => $body.'_decision',
                    'decision' => 'approved',
                    'decided_by' => $actor->id,
                    'decided_at' => now(),
                    'comments' => $data['comments'] ?? ('Institutional approval: '.strtoupper($body)),
                ]);
            } else {
                $reason = $data['comments']
                    ?? sprintf('Institutional %s decision: %s', strtoupper($body), $decision);

                $cycle->update(['status' => BudgetCycle::STATUS_FINANCE_REVIEW]);

                BudgetCycleApproval::create([
                    'budget_cycle_id' => $cycle->id,
                    'stage' => $body.'_decision',
                    'decision' => 'returned',
                    'decided_by' => $actor->id,
                    'decided_at' => now(),
                    'comments' => $reason,
                ]);
            }

            return $row->fresh(['recordedBy']);
        });
    }

    private function assertRecorder(User $actor): void
    {
        if (
            $actor->hasRole('Finance Controller')
            || $actor->hasRole('Governance Officer')
            || $actor->can('finance.admin')
            || $actor->isSystemAdmin()
        ) {
            return;
        }

        abort(403);
    }

    private function assertTenant(BudgetCycle $cycle, User $actor): void
    {
        if ((int) $cycle->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }
    }
}
